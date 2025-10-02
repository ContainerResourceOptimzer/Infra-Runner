// grpc/handlers/runJob.ts

import { exec } from "child_process";
import { promisify } from "util";
import type { handleUnaryCall } from "@grpc/grpc-js";

import { httpServiceHandlers } from "../../http/client.js";
import type { JobResult } from "../../http/types.js";
import {
	activeJobs,
	experimentConfigs,
	getNextJobId,
	jobEnvs,
} from "../state.js";

type GrpcCallback = Parameters<handleUnaryCall<any, any>>[1];

const sh = promisify(exec);
let signalHandlersRegistered = false;

async function shutdownActiveJobs(signal: string): Promise<void> {
	const composeFile = process.env.DEFAULT_COMPOSE_FILE;
	if (!composeFile) {
		console.warn(
			`Cannot clean up active jobs on ${signal}: DEFAULT_COMPOSE_FILE is not set.`
		);
		return;
	}

	const entries = Array.from(jobEnvs.entries());
	if (entries.length === 0) return;

	console.log(
		`Received ${signal}. Cleaning up ${entries.length} active job(s).`
	);
	await Promise.allSettled(
		entries.map(([projectName, env]) =>
			sh(
				`docker compose --compatibility -f ${composeFile} -p ${projectName} down -v`,
				{ env }
			).catch((err) =>
				console.error(
					`Failed to clean up ${projectName}:`,
					err.stderr || err.message
				)
			)
		)
	);
	activeJobs.clear();
	jobEnvs.clear();
}

function ensureSignalHandlersRegistered(): void {
	if (signalHandlersRegistered) return;
	["SIGINT", "SIGTERM"].forEach((signal) => {
		process.once(signal, () => {
			shutdownActiveJobs(signal)
				.catch((err) => console.error("Error while cleaning up jobs:", err))
				.finally(() => process.exit(0));
		});
	});
	signalHandlersRegistered = true;
}

function respondWithExitCode(
	exitCode: number,
	jobOrder: number,
	jobId: string,
	jobResult: JobResult,
	callback: GrpcCallback
): boolean {
	switch (exitCode) {
		case 0: {
			callback(null, {
				jobId,
				success: true,
				totalReqs: jobResult.totalReqs,
				durationAvg: jobResult.durationAvg,
				failedRate: jobResult.failedRate,
				thresholdsPassed: true,
			});
			return true;
		}
		case 99:
		case 100:
		case 101:
		case 102:
		case 103:
		case 108:
		case 110: {
			console.warn(
				`Job ${jobId} (order ${jobOrder}) completed with SLA-related exit code ${exitCode}`
			);
			callback(null, {
				jobId,
				success: true,
				totalReqs: jobResult.totalReqs,
				durationAvg: jobResult.durationAvg,
				failedRate: jobResult.failedRate,
				thresholdsPassed: false,
			});
			return true;
		}
		case 105: {
			console.warn(
				`Job ${jobId} aborted by external signal (exit ${exitCode})`
			);
			throw new Error(`k6 aborted by external signal (${exitCode})`);
		}
		case 97:
		case 98:
		case 104:
		case 106:
		case 107: {
			throw new Error(`k6 runtime/config error. Exit code: ${exitCode}`);
		}
		default: {
			console.warn(`Job ${jobId} returned unexpected exit code ${exitCode}`);
			callback(null, {
				jobId,
				success: false,
				totalReqs: jobResult.totalReqs,
				durationAvg: jobResult.durationAvg,
				failedRate: jobResult.failedRate,
			});
			return true;
		}
	}
}

export const runJobHandler: handleUnaryCall<any, any> = async (
	call,
	callback
) => {
	const { expId, cpu, mem } = call.request;
	const experimentConfig = experimentConfigs.get(expId);

	if (!experimentConfig?.testApiImage) {
		console.log("Error: Run Experiment, Not Exist Experiment Configs");
		callback(null, {
			jobId: "null",
			success: false,
		});
		return;
	}

	const jobOrder = await getNextJobId(expId);
	const jobId = `job-${jobOrder}`;
	const composeProject = `job-${expId}-${jobOrder}`;
	const env: NodeJS.ProcessEnv = {
		...process.env,
		CPU: String(cpu),
		MEM: String(mem),
		EXP_ID: expId,
		JOB_ID: jobId,
		TEST_API_IMAGE: experimentConfig.testApiImage,
		HTTP_REQ_DURATION: String(experimentConfig.httpReqDuration),
		HTTP_REQS: String(experimentConfig.httpReqs),
	};

	console.log(`Run Experiment(${expId}): [${jobId} (${cpu}, ${mem})]`);
	const compose = (cmd: string) =>
		sh(
			`docker compose --compatibility -f ${process.env.DEFAULT_COMPOSE_FILE} -p ${composeProject} ${cmd}`,
			{ env }
		);

	ensureSignalHandlersRegistered();
	activeJobs.add(composeProject);
	jobEnvs.set(composeProject, env);

	let stackStarted = false;
	let responded = false;

	try {
		await compose("up -d");
		stackStarted = true;

		const { stdout: id } = await compose("ps -q k6");
		const k6ContainerId = id.trim();
		if (!k6ContainerId)
			throw new Error("k6 container not found after compose up");

		const { stdout: code } = await sh(`docker wait ${k6ContainerId}`);
		const exitCode = parseInt(code, 10);
		if (Number.isNaN(exitCode))
			throw new Error(`Unable to parse docker wait exit code: ${code}`);

		const jobResult: JobResult =
			await httpServiceHandlers.queryJobResultFromPrometheus(expId, jobId);

		responded = respondWithExitCode(
			exitCode,
			jobOrder,
			jobId,
			jobResult,
			callback
		);
	} catch (e: any) {
		console.error(
			`Experiment ${expId} job ${jobId} error:`,
			e.stderr || e.message
		);
		if (!responded)
			callback(null, {
				jobId,
				success: false,
				totalReqs: 0,
				durationAvg: 0,
				failedRate: 0,
				thresholdsPassed: false,
			});
	} finally {
		const cleanup = async () => {
			try {
				await compose("down -v");
				console.log(`[${jobId}] stack cleaned up`);
			} catch (cleanupError: any) {
				const message = cleanupError.stderr || cleanupError.message;
				if (stackStarted)
					console.error(
						`Experiment ${expId} job ${jobId} cleanup error:`,
						message
					);
				else
					console.debug(
						`Experiment ${expId} job ${jobId} cleanup skipped:`,
						message
					);
			}
		};

		await cleanup();
		activeJobs.delete(composeProject);
		jobEnvs.delete(composeProject);
	}
};

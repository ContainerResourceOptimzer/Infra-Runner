// grpc/client.ts

import { exec } from "child_process";
import { promisify } from "util";
import { Mutex } from "async-mutex";

import { JobResult } from "../http/types.js";

import { httpServiceHandlers } from "../http/client.js";
import { analyzer } from "../analyzer.js";

const sh = promisify(exec);
const mutex = new Mutex();

const experimentConfigs = new Map();
let jobId: number = 1;

export const grpcServiceHandlers = {
	runJob: async (call: any, callback: any) => {
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

		const { currentJobId } = await mutex.runExclusive(() => {
			const jobIdToUse = jobId++;
			return { currentJobId: jobIdToUse };
		});

		const env: NodeJS.ProcessEnv = {
			...process.env,
			CPU: cpu,
			MEM: mem,
			EXP_ID: expId,
			JOB_ID: "job-" + currentJobId.toString(),
			TEST_API_IMAGE: experimentConfig.testApiImage,
			HTTP_REQ_DURATION: experimentConfig.httpReqDuration,
			HTTP_REQS: experimentConfig.httpReqs,
		};

		console.log(`Run Experiment(${expId}): [${currentJobId} (${cpu}, ${mem})]`);
		const compose = (cmd: string) =>
			sh(
				`docker compose --compatibility -f ${process.env.DEFAULT_COMPOSE_FILE} -p job-${currentJobId} ${cmd}`,
				{ env },
			);

		try {
			// 1) detached up
			await compose("up -d");

			// 2) k6 컨테이너 ID 얻어서 wait
			const { stdout: id } = await compose("ps -q k6");
			const { stdout: code } = await sh(`docker wait ${id.trim()}`);
			const exitCode = parseInt(code, 10);

			// 3) 테스트 끝났으니 스택 정리
			await compose("down -v");
			console.log(`[${currentJobId}] stack cleaned up`);

			const jobReslt: JobResult =
				await httpServiceHandlers.queryJobResultFromPrometheus(
					expId,
					"job-" + currentJobId.toString(),
				);

			callback(null, {
				jobId: "job-" + currentJobId,
				success: true,
				totalReqs: jobReslt.totalReqs,
				durationAvg: jobReslt.durationAvg,
				failedRate: jobReslt.failedRate,
				thresholdsPassed: analyzer.analyzeJobResult(experimentConfig, jobReslt),
			});
		} catch (e: any) {
			console.error(`Experiment ${currentJobId} error:`, e.stderr || e.message);
			callback(null, {
				jobId: "null",
				success: false,
			});
		}
	},

	runMonitor: async (call: any, callback: any) => {
		const env: NodeJS.ProcessEnv = {
			...process.env,
		};

		console.log(
			`Run Monitor Container` +
				"\n" +
				`docker compose -f ${process.env.MONITOR_COMPOSE_FILE} up -d`,
		);
		await sh(`docker compose -f ${process.env.MONITOR_COMPOSE_FILE} up -d`, {
			env,
		});

		callback(null, {
			success: true,
			message: "Run Monitor Container.",
		});
	},

	initExperimentConfigs: async (call: any, callback: any) => {
		const { expId, testApiImage, httpReqDuration, httpReqs } = call.request;
		console.log(expId);
		experimentConfigs.set(expId, { testApiImage, httpReqDuration, httpReqs });
		console.log(`Init Experiment(${expId}) Configs.`);

		callback(null, {
			success: true,
			message: "Init Experiment Configs.",
		});
	},
};

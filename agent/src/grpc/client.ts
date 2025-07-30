// client.ts

import { exec } from "child_process";
import { promisify } from "util";

const sh = promisify(exec);

let apiPort: number = 3000;
let jobId = 1;

export const grpcServiceHandlers = {
	runJob: async (call: any, callback: any) => {
		const { expId, cpu, mem } = call.request;
		const env: NodeJS.ProcessEnv = {
			...process.env,
			CPU: cpu,
			MEM: mem,
			API_PORT: apiPort.toString(),
			EXP_ID: expId,
			JOB_ID: "job-" + jobId.toString(),
		};

		console.log(
			`Run Experiment(${expId}): [${jobId} (${cpu}, ${mem}) PORT: ${apiPort}]`
		);
		const compose = (cmd: string) =>
			sh(
				`docker compose --compatibility -f ${process.env.DEFAULT_COMPOSE_FILE} -p job-${jobId} ${cmd}`,
				{ env }
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
			console.log(`[${jobId}] stack cleaned up`);

			callback(null, {
				jobId: "job-" + jobId,
				success: exitCode === 0,
			});

			apiPort++;
			jobId++;
		} catch (e: any) {
			console.error(`Experiment ${jobId} error:`, e.stderr || e.message);
		}
	},

	runMonitor: async (call: any, callback: any) => {
		const env: NodeJS.ProcessEnv = {
			...process.env,
		};

		console.log(
			`Run Monitor Container` +
				"\n" +
				`docker compose -f ${process.env.MONITOR_COMPOSE_FILE} up -d`
		);
		await sh(`docker compose -f ${process.env.MONITOR_COMPOSE_FILE} up -d`, {
			env,
		});

		callback(null, {
			success: true,
			message: `Run Monitor Container.`,
		});
	},
};

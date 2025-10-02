// grpc/client.ts

import { exec } from "child_process";
import { promisify } from "util";

import { runJobHandler } from "./handlers/runJob.js";
import { experimentConfigs } from "./state.js";

const sh = promisify(exec);

export const grpcServiceHandlers = {
	runJob: runJobHandler,

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

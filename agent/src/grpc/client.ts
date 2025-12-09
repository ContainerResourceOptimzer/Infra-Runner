// grpc/client.ts

import { runJobHandler } from "./handlers/runJob.js";
import { runMonitorHandler } from "./handlers/runMonitor.js";
import { setExperimentConfig } from "./state.js";

export const grpcServiceHandlers = {
	runJob: runJobHandler,
	runMonitor: runMonitorHandler,

	initExperimentConfigs: async (call: any, callback: any) => {
		const { expId, testApiImage, httpReqDuration, httpReqs, httpFailedRate } =
			call.request;

		console.log(`Init Experiment(${expId}) Configs.`);
		setExperimentConfig(expId, {
			testApiImage,
			httpReqDuration,
			httpReqs,
			httpFailedRate,
		});
		callback(null, {
			success: true,
			message: "Init Experiment Configs.",
		});
	},
};

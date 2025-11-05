// grpc/client.ts

import { runJobHandler } from "./handlers/runJob.js";
import { runMonitorHandler } from "./handlers/runMonitor.js";
import { setExperimentConfig } from "./state.js";

export const grpcServiceHandlers = {
	runJob: runJobHandler,
	runMonitor: runMonitorHandler,

	initExperimentConfigs: async (call: any, callback: any) => {
		const { expId, testApiImage, httpReqDuration, httpReqs } = call.request;
		console.log(expId);
		setExperimentConfig(expId, { testApiImage, httpReqDuration, httpReqs });
		console.log(`Init Experiment(${expId}) Configs.`);

		callback(null, {
			success: true,
			message: "Init Experiment Configs.",
		});
	},
};

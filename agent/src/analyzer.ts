// analyzer.ts

import { JobResult } from "./http/types.js";

export const analyzer = {
	analyzeJobResult: (experimentConfig: any, jobReslt: JobResult) => {
		if (
			experimentConfig.httpReqs <= jobReslt.totalReqs &&
			experimentConfig.httpReqDuration > jobReslt.durationAvg * 1000 &&
			jobReslt.failedRate < 10
		)
			return true;
		return false;
	},
};

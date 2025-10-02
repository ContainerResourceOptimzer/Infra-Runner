import { Mutex } from "async-mutex";

import { ExperimentConfig } from "./types.js";

export const experimentConfigs: Map<string, ExperimentConfig> = new Map<
	string,
	ExperimentConfig
>();
export const activeJobs: Set<string> = new Set<string>();
export const jobEnvs: Map<string, NodeJS.ProcessEnv> = new Map<
	string,
	NodeJS.ProcessEnv
>();

const jobIdMutex: Mutex = new Mutex();
const jobIdCounters: Map<string, number> = new Map<string, number>();

export async function getNextJobId(expId: string): Promise<number> {
	return jobIdMutex.runExclusive(() => {
		const next = (jobIdCounters.get(expId) ?? 0) + 1;
		jobIdCounters.set(expId, next);
		return next;
	});
}

export function setExperimentConfig(expId: string, config: ExperimentConfig): void {
	experimentConfigs.set(expId, config);
	jobIdCounters.delete(expId);
}

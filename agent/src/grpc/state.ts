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
let jobIdCounter: number = 1;

export async function getNextJobId(): Promise<number> {
	return jobIdMutex.runExclusive(() => jobIdCounter++);
}

// grpc/types.ts

export interface ExperimentConfig {
	testApiImage: string;
	httpReqDuration: number;
	httpReqs: number;
	httpFailedRate: number;
}

// types.ts

export interface PrometheusResponse<T> {
	status: "success" | "error";
	data: {
		resultType: "vector" | "matrix" | "scalar" | "string";
		result: T[];
	};
	errorType?: string;
	error?: string;
}

export interface PrometheusMetric {
	what: string;
}

// Instant Query 결과 아이템
export interface InstantResult {
	metric: PrometheusMetric;
	// [ <timestamp in unix>, <value as string> ]
	value: [number, string];
}

// Range Query 결과 아이템
export interface RangeResult {
	metric: Record<string, string>;
	// [ <timestamp>, <value> ] 배열
	values: [number, string][];
}

export interface JobResult {
	expId: string;
	jobId: string;
	totalReqs: number;
	durationAvg: number;
	failedRate: number;
	thresholdsPassed: boolean;
}

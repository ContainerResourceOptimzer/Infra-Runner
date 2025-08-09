// http/client.ts

import axios from "axios";
import { PrometheusResponse, InstantResult, JobResult } from "./types.js";

async function queryPrometheus(
	query: string
): Promise<PrometheusResponse<InstantResult>> {
	const prometheusUrl = `http://${process.env.PROMETHEUS_HOST || "localhost"}:${
		process.env.PROMETHEUS_PORT || 9090
	}`;
	const url = `${prometheusUrl}/api/v1/query?query=${encodeURIComponent(
		query
	)}`;

	try {
		const response = await axios.get<PrometheusResponse<InstantResult>>(url);
		return response.data;
	} catch (error) {
		console.error("Error querying Prometheus:", error);
		return {
			status: "error",
			data: {
				resultType: "vector",
				result: [],
			},
			error: "Failed to query Prometheus",
		};
	}
}

export const httpServiceHandlers = {
	queryJobResultFromPrometheus: async (
		expId: string,
		jobId: string,
		timeLen: string = "5m"
	): Promise<JobResult> => {
		const query = `
			label_replace(
				vector( scalar( sum(increase(k6_http_reqs_total{experiment="${expId}", container="${jobId}"}[${timeLen}])) ) ),
				"what","http_reqs","",""
			)
			OR
			label_replace(
				vector( scalar( sum(avg_over_time(k6_http_req_duration_p95{experiment="${expId}", container="${jobId}"}[${timeLen}])) ) ),
				"what","http_req_duration_p95_ms","",""
			)
		`;

		const response = await queryPrometheus(query);

		let totalReqs = 0;
		let duurationAvg = 0;

		if (
			response.status === "success" &&
			response.data.resultType === "vector"
		) {
			response.data.result.forEach((item: InstantResult) => {
				if (item.metric.what === "http_reqs") {
					totalReqs = parseFloat(item.value[1]);
				} else if (item.metric.what === "http_req_duration_p95_ms") {
					duurationAvg = parseFloat(item.value[1]);
				}
			});
		}

		return { expId, jobId, totalReqs, duurationAvg };
	},
};

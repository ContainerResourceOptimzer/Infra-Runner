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
					sum(k6_http_reqs_total{experiment="${expId}", container="${jobId}"}), 
					"what", "http_reqs_total", "", ""
				)
				OR
				label_replace(
					histogram_quantile(0.95, sum by (le) (rate(k6_http_req_duration_seconds{experiment="${expId}", container="${jobId}"}[${timeLen}]))), 
					"what", "http_req_duration_p95", "", ""
				)
				OR
				label_replace(
					(sum(increase(k6_http_reqs_total{experiment="${expId}", container="${jobId}"}[${timeLen}]) 
					* 
					avg_over_time(k6_http_req_failed_rate{experiment="${expId}", container="${jobId}"}[${timeLen}])) 
					/ 
					sum(increase(k6_http_reqs_total{experiment="${expId}", container="${jobId}"}[${timeLen}]))) * 100,
					"what", "http_req_failed_rate", "", ""
					)
		`;

		const response = await queryPrometheus(query);

		let totalReqs = 0;
		let durationAvg = 0;
		let failedRate = 0;

		if (
			response.status === "success" &&
			response.data.resultType === "vector"
		) {
			response.data.result.forEach((item: InstantResult) => {
				if (item.metric.what === "http_reqs_total") {
					totalReqs = parseInt(item.value[1]);
				} else if (item.metric.what === "http_req_duration_p95") {
					durationAvg = parseFloat(item.value[1]);
				} else if (item.metric.what === "http_req_failed_rate") {
					failedRate = parseFloat(item.value[1]);
				}
			});
		}
		return {
			expId,
			jobId,
			totalReqs,
			durationAvg,
			failedRate,
			thresholdsPassed: false,
		};
	},
};

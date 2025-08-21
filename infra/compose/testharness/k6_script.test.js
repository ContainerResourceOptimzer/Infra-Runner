import http from "k6/http";
import { check, sleep, group } from "k6";

/* 테스트 통과 조건
	- 요청 응답 시간 95%가 {__ENV.HTTP_REQ_DURATION}초 이내
	- 총 {__ENV.HTTP_REQ_DURATION}건 이상 요청 발생
	- 실패율 5% 미만
*/
export const options = {
	stages: [
		{ duration: "30s", target: 20 }, // 30초 동안 사용자를 100명까지 늘립니다 (Ramp-up)
		{ duration: "30s", target: 40 }, // 1분 동안 사용자 100명을 유지합니다 (Sustained Load)
		{ duration: "10s", target: 0 }, // 30초 동안 사용자를 0명으로 줄입니다 (Ramp-down)
	],
	thresholds: {
		http_req_duration: [`p(95)<=${__ENV.HTTP_REQ_DURATION}`],
		http_reqs: [`count>=${__ENV.HTTP_REQS}`],
		http_req_failed: ["rate<5.0"],
	},
	tags: {
		experiment: __ENV.EXP_ID,
		container: __ENV.JOB_ID,
	},
};

const BASE_URL = "http://api:3000";
const REQ_TIMEOUT = __ENV.HTTP_TIMEOUT || "120s";

// VU / ITER 기반 토글: 각 VU마다 매 반복의 절반만 true
function shouldRunDbThisIter() {
	return (__ITER + __VU) % 2 === 0;
}

export function setup() {
	for (let i = 0; i < 60; i++) {
		const r = http.get(`${BASE_URL}/api/boards`, { timeout: "5s" });
		if (r.status === 200) return;
		sleep(1);
	}
	throw new Error("API not ready after 60s");
}

export default function () {
	// CPU 부하 테스트 API를 호출합니다.
	const res1 = http.get(`${BASE_URL}/api/cpu-load-test?n=10`, {
		tags: { name: "cpu-load-test" },
		timeout: REQ_TIMEOUT,
	});
	check(res1, {
		"CPU test: status is 200": (r) => r.status === 200,
	});

	if (shouldRunDbThisIter()) {
		const res2 = http.get(`${BASE_URL}/api/db-stress-test`, {
			tags: { name: "db-stress-test" },
			timeout: REQ_TIMEOUT,
		});
		check(res2, {
			"DB test: status is 200": (r) => r.status === 200,
			"DB test: response contains data": (r) =>
				r.status === 200 && r.json("data") !== null,
		});
	}

	const res3 = http.get(`${BASE_URL}/api/memory-test?size=${500}}`, {
		tags: { name: "memory-test" }, // ← 쿼리파라미터가 달라도 한 버킷으로 모임
		timeout: REQ_TIMEOUT,
	});
	check(res3, {
		"Memory test: status is 200": (r) => r.status === 200,
	});

	sleep(1);
}

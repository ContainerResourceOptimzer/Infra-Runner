#!/bin/bash

grpcurl -plaintext -import-path . -proto ./agent/proto/agent.proto -d \
	'{}' \
	localhost:50051 runner.RunnerAgent/RunMonitor

grpcurl -plaintext -import-path . -proto ./agent/proto/agent.proto -d \
	'{"exp_id": "exp-1", "test_api_image": "iamdudumon/my-nest-app", "http_req_duration": 3000, "http_reqs": 1000}' \
	localhost:50051 runner.RunnerAgent/InitExperimentConfigs

grpcurl -plaintext -import-path . -proto ./agent/proto/agent.proto -d \
	'{"exp_id": "exp-1", "test_api_image": "test-api-server", "http_req_duration": 30000, "http_reqs": 500}' \
	localhost:50051 runner.RunnerAgent/InitExperimentConfigs

grpcurl -plaintext -import-path . -proto ./agent/proto/agent.proto -d \
	'{"exp_id": "exp-1", "cpu": 1.0, "mem": "1024M"}' \
	localhost:50051 runner.RunnerAgent/RunJob

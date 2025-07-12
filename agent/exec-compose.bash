#!/bin/bash

grpcurl -plaintext -import-path . -proto ./proto/runner_agent.proto -d \
	'{"job_id": "exp-2", "cpu": 1.5, "mem": "512M"}' \
	localhost:50051 runner.RunnerAgent/RunExperiment

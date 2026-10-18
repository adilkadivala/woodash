import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { config } from '../config.js';

export type CmdResult = { code: number; stdout: string; stderr: string };

function kubeAvailable(): boolean {
  if (process.env.KUBERNETES_SERVICE_HOST) return true;
  if (process.env.KUBECONFIG && existsSync(process.env.KUBECONFIG)) return true;
  if (existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) return true;
  if (existsSync(`${homedir()}/.kube/config`)) return true;
  return false;
}

export function provisioningAvailable(): { ok: boolean; reason?: string } {
  if (!kubeAvailable()) {
    return {
      ok: false,
      reason: 'PROVISIONING_REQUIRES_KUBERNETES',
    };
  }
  return { ok: true };
}

export function runCmd(
  bin: string,
  args: string[],
  timeoutMs: number,
): Promise<CmdResult> {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
    }, timeoutMs);
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: err.message });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function runHelm(args: string[], timeoutMs: number): Promise<CmdResult> {
  return runCmd(config.HELM_BIN, args, timeoutMs);
}

export async function runKubectl(args: string[], timeoutMs = 60_000): Promise<CmdResult> {
  return runCmd(config.KUBECTL_BIN, args, timeoutMs);
}

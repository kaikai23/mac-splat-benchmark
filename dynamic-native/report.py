#!/usr/bin/env python3
"""Create a self-contained report from an audited Visionary native ONNX run."""
from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import hashlib
import html
import io
import json
import math
from pathlib import Path
import statistics
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
CAPTURE_INDICES = [0, 50, 100, 149]
PHASES = ("inferenceWallMs", "renderCompletionMs")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def identity(path):
    return {"path": str(path.resolve()), "bytes": path.stat().st_size, "sha256": sha(path)}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def close(value, expected, label):
    require(finite(value) and math.isclose(value, expected, rel_tol=1e-10, abs_tol=1e-8), f"Timing mismatch: {label}")


def percentile(values, p):
    ordered = sorted(values)
    require(ordered and all(finite(value) and value >= 0 for value in ordered), "Invalid timing values")
    rank = (len(ordered) - 1) * p
    lo, hi = math.floor(rank), math.ceil(rank)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (rank - lo)


def timing(values):
    return {"meanMs": statistics.fmean(values), "p50Ms": percentile(values, .5), "p95Ms": percentile(values, .95)}


def safe_result_path(run, relative):
    path = Path(relative)
    require(not path.is_absolute() and ".." not in path.parts, f"Unsafe result path: {relative}")
    resolved = (run / path).resolve()
    require(resolved.is_relative_to(run) and resolved.is_file(), f"Missing or escaped result: {relative}")
    return resolved


def fresh_audit_sources(audit, required_paths):
    rows = audit.get("sourceFiles")
    require(isinstance(rows, list) and rows, "Independent audit has no sourceFiles lineage")
    bound = {}
    for row in rows:
        require(isinstance(row, dict) and isinstance(row.get("path"), str), "Malformed source identity")
        location = Path(row["path"])
        location = location.resolve() if location.is_absolute() else (ROOT / location).resolve()
        require(location.is_file(), f"Audited source is missing: {location}")
        expected = (row.get("bytes"), row.get("sha256"))
        require((location.stat().st_size, sha(location)) == expected, f"Stale independent audit: {location}")
        require(location not in bound or bound[location] == expected, f"Conflicting source aliases: {location}")
        bound[location] = expected
    for path in required_paths:
        require(path.resolve() in bound, f"Audit did not bind report input: {path}")


def environment(protocol, record):
    host = protocol["host"]
    hardware = host.get("hardware", {})
    machine = (hardware.get("SPHardwareDataType") or [{}])[0]
    gpu = (hardware.get("SPDisplaysDataType") or [{}])[0]
    return {"chip": machine.get("chip_type", "未记录"), "machine": machine.get("machine_name", "未记录"),
            "memory": machine.get("physical_memory", "未记录"), "cpu": machine.get("number_processors", "未记录"),
            "gpu": gpu.get("sppci_model", gpu.get("_name", "未记录")), "gpuCores": gpu.get("sppci_cores", "未记录"),
            "os": host.get("osVersion", "未记录"), "architecture": host.get("architecture", "未记录"),
            "browser": host.get("browserVersion", "未记录"), "runtimeBrowser": record.get("browserVersion", "未记录"),
            "node": host.get("nodeVersion", "未记录"), "acLowPowerMode": host.get("acLowPowerMode"),
            "checkedPowerProfile": host.get("checkedPowerProfile"),
            "gpuAdapter": record.get("metadata", {}).get("gpuAdapter", {})}


def inspect_run(run):
    protocol, audit, record = (read(run / name) for name in ("protocol.json", "audit.json", "visionary.json"))
    require(protocol.get("schema") == "visionary-native-4dgs-v1", "Not a native ONNX experiment")
    require(protocol.get("mode") in ("pilot", "formal"), "Probe output is not a timing report")
    require(protocol.get("methods") == ["visionary"], "Expected Visionary only")
    require(audit.get("schema") == "visionary-native-4dgs-independent-audit-v1", "Unsupported independent audit")
    require(audit.get("passed") is True and audit.get("complete") is True and not audit.get("errors"), "Complete passed independent audit required")
    require(audit.get("mode") == protocol["mode"] and audit.get("protocolSha256") == sha(run / "protocol.json"), "Audit protocol binding changed")
    require(len(audit.get("records", [])) == 1 and audit["records"][0].get("method") == "visionary", "Audit method coverage differs")
    require((protocol.get("width"), protocol.get("height"), protocol.get("dpr")) == (1280, 720, 1), "Unexpected framebuffer/DPR")
    repeats = 5 if protocol["mode"] == "formal" else 1
    require(protocol.get("rounds") == repeats and protocol.get("framesPerRound") == 150, "Unexpected time coverage")
    require(record.get("status") == "complete" and record.get("method") == "visionary", "Raw collection incomplete")
    require(record.get("protocolSha256") == sha(run / "protocol.json"), "Raw protocol binding changed")
    require(not record.get("errors") and not record.get("metadata", {}).get("events"), "Raw runtime errors")
    complete, runtime = read(run / "complete.json"), read(run / "runtime.json")
    require(complete.get("complete") is True and runtime.get("complete") is True, "Runtime incomplete")
    require(runtime.get("gpuLockReleased") is True and isinstance(runtime.get("ownedChildren"), list), "Missing cleanup evidence")
    require(all(child.get("alive") is False for child in runtime["ownedChildren"]), "Runtime children still alive")
    require(complete.get("methods") == [{"method": "visionary", "sha256": sha(run / "visionary.json")}], "Raw completion SHA differs")
    receipts = audit.get("sourceReceipts", {})
    for field, name in (("protocolSha256", "protocol.json"), ("completeSha256", "complete.json"), ("runtimeSha256", "runtime.json")):
        require(receipts.get(field) == sha(run / name), f"Audit {field} differs")
    require(receipts.get("methods") == {"visionary": sha(run / "visionary.json")}, "Audit raw binding differs")
    paths = [run / name for name in ("protocol.json", "complete.json", "runtime.json", "visionary.json")]
    telemetry_path = safe_result_path(run, record["telemetryPath"])
    require(sha(telemetry_path) == record["telemetrySha256"], "Power telemetry changed")
    paths.append(telemetry_path)
    telemetry = read(telemetry_path)
    require(not telemetry.get("error") and telemetry.get("samples"), "Power telemetry error or empty log")
    require(all("'AC Power'" in row.get("power", "") for row in telemetry["samples"]), "Non-AC telemetry")
    require(len(record["rounds"]) == repeats, "Incomplete rounds")
    all_samples, per_round = [], []
    for repeat, round_ in enumerate(record["rounds"]):
        require(round_.get("repeat") == repeat and len(round_["samples"]) == 150, "Round content coverage changed")
        values = []
        for index, sample in enumerate(round_["samples"]):
            require(sample.get("index") == index and sample.get("repeat") == repeat, "Time sample order changed")
            close(sample.get("requestedTime"), index / 149, "normalized time")
            for key in ("e2eCompletionMs", *PHASES):
                require(finite(sample.get(key)) and sample[key] > 0, f"Invalid {key}")
            close(sample["e2eCompletionMs"], sample["e2eEndMs"] - sample["e2eStartMs"], "E2E clock")
            require(sample["inferenceWallMs"] + sample["renderCompletionMs"] <= sample["e2eCompletionMs"] + 1e-6,
                    "Adapter phases exceed outer completion clock")
            values.append(sample["e2eCompletionMs"])
        window = round_["windowElapsedMs"]
        require(finite(window) and window > 0, "Invalid window duration")
        close(window, round_["windowEndMs"] - round_["windowStartMs"], "round clock")
        require(window + 1e-6 >= sum(values), "Round window shorter than individual samples")
        per_round.append({"repeat": repeat, "sampleCount": 150, "windowElapsedMs": window,
                          "completedFramesPerSecond": 150000 / window, **timing(values)})
        all_samples.extend(round_["samples"])
    total_window = sum(row["windowElapsedMs"] for row in per_round)
    stats = {"sampleCount": len(all_samples), "totalWindowMs": total_window,
             "completedFramesPerSecond": len(all_samples) * 1000 / total_window,
             **timing([sample["e2eCompletionMs"] for sample in all_samples])}
    for key, value in stats.items():
        close(record["e2e"][key], value, f"stored e2e.{key}")
    phases = {phase: timing([sample[phase] for sample in all_samples]) for phase in PHASES}
    for phase, values in phases.items():
        for key, value in values.items():
            close(record["phases"][phase][key], value, f"stored {phase}.{key}")
    gpu = {}
    for key in ("prepMs", "sortMs", "drawMs", "totalMs"):
        values = [sample.get("gpu", {}).get(key) for sample in all_samples]
        require(all(finite(value) and value >= 0 for value in values), f"Missing real GPU {key} query values")
        gpu[key] = timing(values)
    captures = []
    require([item["index"] for item in record["captures"]] == CAPTURE_INDICES, "Expected exactly four temporal captures")
    for capture in record["captures"]:
        close(capture["time"], capture["index"] / 149, "capture time")
        path = safe_result_path(run, capture["path"])
        require(sha(path) == capture["sha256"], "Capture SHA changed")
        payload = path.read_bytes()
        require(payload[:8] == b"\x89PNG\r\n\x1a\n" and struct.unpack(">II", payload[16:24]) == (1280, 720), "Capture must be native 1280x720 PNG")
        captures.append({"index": capture["index"], "time": capture["time"], "path": capture["path"],
                         "sha256": capture["sha256"], "inspection": capture.get("inspection", {}),
                         "dataUri": "data:image/png;base64," + base64.b64encode(payload).decode()})
        paths.append(path)
    fresh_audit_sources(audit, paths)
    return {"protocol": protocol, "audit": audit, "record": record, "telemetry": telemetry,
            "e2e": stats, "phases": phases, "gpu": gpu, "rounds": per_round, "samples": all_samples,
            "captures": captures, "inputs": paths + [run / "audit.json"]}


def content_sweep_summary(record, audit_record):
    inspections = record.get("contentSweep")
    validation = audit_record.get("contentValidation", {})
    rows = validation.get("fullContentSweep")
    require(isinstance(inspections, list) and isinstance(rows, list) and len(inspections) == len(rows) == 150,
            "Missing complete all-time content sweep")
    require(validation.get("allSweepRenderableGaussianFieldsFinite") is True, "Renderable finite-content audit failed")
    active, culled, renderable = [], [], []
    for index, (inspection, row) in enumerate(zip(inspections, rows)):
        require(inspection.get("index") == row.get("index") == index, "Content sweep order differs")
        close(inspection.get("requestedTime"), index / 149, "content sweep time")
        close(row.get("requestedTime"), index / 149, "audited content sweep time")
        bounds = inspection.get("fullBounds", {})
        count = inspection.get("gaussianCount")
        require(type(count) is int and count > 0 and bounds.get("inspectedCount") == row.get("activeCount") == count,
                "Content sweep active count differs")
        require(bounds.get("opacityThreshold") == .02 and bounds.get("diagnosticNonfiniteEnabled") is False,
                "Relaxed finite-content mode cannot be reported")
        require(bounds.get("allRenderableGaussianFieldsFinite") is True, "Unsafe renderable Gaussian in sweep")
        counts = []
        for key in ("nonfiniteCulledGaussianCount", "nonfiniteRenderableGaussianCount"):
            value = bounds.get(key)
            require(type(value) is int and 0 <= value <= count and row.get(key) == value,
                    "Content sweep nonfinite counts differ")
            counts.append(value)
        require(counts[1] == 0 and bounds.get("nonfiniteGaussianCount") == counts[0], "Unsafe nonfinite content remains")
        require(bounds.get("allGaussianFieldsFinite") is (counts[0] == 0), "All-finite flag differs from exceptions")
        active.append(count); culled.append(counts[0]); renderable.append(counts[1])
    require(validation.get("nonfiniteCulledRowsAcrossSweep") == sum(culled), "Audited culled-row sum differs")
    require(isinstance(validation.get("nativeOpacityCullEvidence"), dict) and validation["nativeOpacityCullEvidence"],
            "Missing frozen native shader cull evidence")
    return {"testedTimes": 150, "expectedTimes": 150, "timeSampling": "t=i/149, i=0..149",
            "outsideMeasuredSamples": True, "activeCountMin": min(active), "activeCountMax": max(active),
            "allSweepRenderableGaussianFieldsFinite": True, "nonfiniteRenderableGaussianCountMax": max(renderable),
            "nonfiniteCulledGaussianCountMax": max(culled), "timesWithNonfiniteCulledGaussians": sum(n > 0 for n in culled),
            "nonfiniteCulledRowObservationsAcrossSweep": sum(culled), "nativeOpacityThreshold": .02,
            "originalGpuOutputUnmodified": True,
            "validationScope": "All active XYZ/alpha must be finite; covariance must be finite for alpha>=0.02. Only covariance unread after frozen native alpha<0.02 early return may be nonfinite. Full Gaussian10 scan; SH values are sampled separately.",
            "observationSumIsUniquePointCount": False}


def esc(value):
    return html.escape(str(value), quote=True)


def fmt(value, digits=3):
    return "—" if value is None else f"{value:,.{digits}f}"


def table(headers, rows):
    return '<div class="table-scroll"><table><thead><tr>' + ''.join(f'<th>{esc(item)}</th>' for item in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{esc(value)}</td>' for value in row) + '</tr>' for row in rows) + '</tbody></table></div>'


def json_box(value):
    return '<pre>' + esc(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)) + '</pre>'


def make_csv(fields, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def html_report(summary, state, csv_summary):
    e2e, phases, protocol = summary["e2e"], summary["phases"], summary["protocol"]
    formal = summary["mode"] == "formal"
    mode_label = "正式原生动态测量" if formal else "原生动态试跑（不是正式结果）"
    phase_labels = {"inferenceWallMs": "原生 ONNX 推理完成", "renderCompletionMs": "当前帧渲染完成与查询读回"}
    phase_table = table(["连续区间", "mean ms", "P50 ms", "P95 ms"], [[phase_labels[key], *[fmt(phases[key][stat]) for stat in ("meanMs", "p50Ms", "p95Ms")]] for key in PHASES])
    gpu_labels = {"prepMs": "GPU 预处理", "sortMs": "GPU radix 排序", "drawMs": "GPU 绘制", "totalMs": "预处理开始至绘制结束跨度"}
    gpu_table = table(["WebGPU 查询区间", "mean ms", "P50 ms", "P95 ms"], [[gpu_labels[key], *[fmt(row[stat]) for stat in ("meanMs", "p50Ms", "p95Ms")]] for key, row in summary["gpuDiagnostics"].items()])
    round_table = table(["轮", "完成帧", "窗口 ms", "完整 FPS", "E2E mean ms", "P50 ms", "P95 ms"], [[r["repeat"] + 1, r["sampleCount"], fmt(r["windowElapsedMs"]), fmt(r["completedFramesPerSecond"]), fmt(r["meanMs"]), fmt(r["p50Ms"]), fmt(r["p95Ms"])] for r in summary["rounds"]])
    gallery = ''
    for capture in state["captures"]:
        gallery += f'<figure><img src="{capture["dataUri"]}" alt="Visionary 原生 ONNX，采样 {capture["index"]}，t={capture["time"]:.6f}" width="1280" height="720" loading="lazy"><figcaption>采样 {capture["index"]} / 149 · t={capture["time"]:.6f}<small>PNG SHA256 {esc(capture["sha256"])}</small></figcaption></figure>'
    details = ''
    for round_ in state["record"]["rounds"]:
        rows = [[s["index"], fmt(s["requestedTime"], 6), fmt(s["e2eCompletionMs"]), fmt(s["inferenceWallMs"]), fmt(s["renderCompletionMs"])] for s in round_["samples"]]
        details += f'<details><summary>第 {round_["repeat"] + 1} 轮 · 全部150个时间点</summary>' + table(["采样", "请求 t", "完整帧 ms", "推理完成 ms", "渲染完成 ms"], rows) + '</details>'
    host_rows = [[key, value] for key, value in summary["environment"].items() if key != "gpuAdapter"]
    csv_uri = 'data:text/csv;charset=utf-8;base64,' + base64.b64encode(csv_summary.encode()).decode()
    capacity_rows = [[item.get("name"), item.get("dataType"), json.dumps(item.get("shape"))] for item in summary["modelInfo"].get("outputs", [])]
    sweep = summary["contentSweep"]
    sweep_table = table(["完整内容检查（计时外）", "本次记录"], [
        ["请求时刻覆盖", f'{sweep["testedTimes"]} / {sweep["expectedTimes"]}'],
        ["全量扫描的有效点数范围", f'{sweep["activeCountMin"]:,} – {sweep["activeCountMax"]:,}'],
        ["会进入渲染路径的非有限高斯：单时刻最大", sweep["nonfiniteRenderableGaussianCountMax"]],
        ["原生低透明度早退的非有限协方差高斯：单时刻最大", sweep["nonfiniteCulledGaussianCountMax"]],
        ["观察到上述低透明度异常的时刻数", sweep["timesWithNonfiniteCulledGaussians"]],
        ["上述异常逐时刻观测数之和（非唯一点数）", sweep["nonfiniteCulledRowObservationsAcrossSweep"]]])
    model_link = summary["modelLock"].get("publicView", summary["modelLock"].get("url", ""))
    require(isinstance(model_link, str) and model_link.startswith("https://"), "Model lock has no HTTPS source link")
    model_name = summary["modelLock"].get("name", summary["modelLock"].get("filename", "官方原生ONNX模型"))
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visionary 原生 ONNX 动态实测</title><style>
:root{{color-scheme:light;--ink:#173045;--muted:#536977;--border:#d6e2e7;--accent:#096976}}*{{box-sizing:border-box}}body{{margin:0;color:var(--ink);background:#f2f6f8;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1260px;padding:32px 24px 64px;margin:auto}}header{{padding:22px 0}}h1{{font-size:clamp(30px,4.2vw,49px);line-height:1.2;margin:12px 0}}h2{{font-size:25px;margin:0 0 16px}}h3{{font-size:18px}}a{{color:var(--accent)}}p{{margin:10px 0}}nav{{display:flex;flex-wrap:wrap;gap:16px}}section{{min-width:0;background:white;border:1px solid var(--border);border-radius:16px;padding:24px;margin:20px 0}}.eyebrow{{font-weight:700;letter-spacing:.08em;color:var(--accent)}}.muted,small{{color:var(--muted)}}.cards{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}.card{{border:1px solid #c9e1e4;border-radius:12px;padding:20px;background:#eaf4f5}}.card strong{{display:block;font-size:40px;line-height:1.4}}.card span,.card small{{display:block}}.table-scroll{{max-width:100%;overflow-x:auto;margin:16px 0}}table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums}}th{{background:#eef4f6;white-space:nowrap}}.gallery{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}}figure{{margin:0;min-width:0}}img{{display:block;width:100%;height:auto;background:#111;border-radius:8px}}figcaption{{padding:8px 0;font-weight:600}}figcaption small{{display:block;font:10px/1.5 monospace;overflow-wrap:anywhere}}details{{margin:16px 0;min-width:0}}summary{{cursor:pointer;font-weight:600}}code{{overflow-wrap:anywhere;word-break:break-word}}pre{{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;background:#f3f7f9;padding:16px;border-radius:8px}}.note{{border-left:4px solid #dd9b25;padding-left:14px}}.badge{{display:inline-block;padding:4px 12px;border-radius:30px;background:#dfefe6;color:#225b43;font-size:13px}}.hash{{font:11px/1.5 monospace;overflow-wrap:anywhere}}@media(max-width:760px){{main{{padding:16px 12px 40px}}section{{padding:18px 14px}}.cards,.gallery{{grid-template-columns:1fr}}.card strong{{font-size:34px}}th,td{{padding:9px}}}}@media print{{body{{background:white}}main{{padding:0;max-width:none}}section{{break-inside:avoid}}}}
</style></head><body><main><header><div class="eyebrow">VISIONARY 1.0.1 · NATIVE ONNX · SHARED WEBGPU BUFFERS</div><h1>原生动态推理到渲染：本机完整帧实测</h1><p>{esc(mode_label)} · {esc(summary["environment"]["chip"])} · 1280×720 · DPR 1</p><p><span class="badge">本次完整独立审计通过</span> <span class="muted">{e2e["sampleCount"]} 个计时样本 · {esc(summary["generatedAt"])}</span></p><nav><a href="#overview">完整帧结果</a><a href="#phases">推理与渲染</a><a href="#rounds">轮次与样本</a><a href="#captures">动态画面</a><a href="#native">原生路径与验收</a><a href="#environment">环境</a><a href="#evidence">来源与证据</a></nav></header>
<section id="overview"><h2>Visionary 完整动态帧</h2><p>本次只测 Visionary 1.0.1，输入为锁定官方模型 <strong>{esc(model_name)}</strong>。对模型输入明确的归一化时间，执行原生 ONNXGenerator 推理，通过同一 GPUDevice 上的共享 GPU buffer 交给 DynamicPointCloud，再完成新预处理、排序和绘制。</p><div class="cards"><article class="card"><div>完整帧吞吐</div><strong>{fmt(e2e["completedFramesPerSecond"])}</strong><span>完成帧 / 秒</span><small>总完成样本 ÷ 总轮窗口</small></article><article class="card"><div>完整帧 P50</div><strong>{fmt(e2e["p50Ms"])}</strong><span>毫秒</span><small>全部逐帧样本 Type7 分位数</small></article><article class="card"><div>完整帧 P95</div><strong>{fmt(e2e["p95Ms"])}</strong><span>毫秒</span><small>包含推理、渲染和完成确认</small></article></div>{table(["方法", "完整 FPS", "E2E mean ms", "P50 ms", "P95 ms", "总窗口 ms", "样本"], [["Visionary 1.0.1", fmt(e2e["completedFramesPerSecond"]), fmt(e2e["meanMs"]), fmt(e2e["p50Ms"]), fmt(e2e["p95Ms"]), fmt(e2e["totalWindowMs"]), e2e["sampleCount"]]])}<p>FPS = 1000 × 全部完成样本数 ÷ 各轮浏览器窗口毫秒之和。窗口包含循环记账，排除预热；P50/P95 来自全部单帧耗时，不平均各轮分位数。</p><p class="note">这是串行原生推理与渲染完成吞吐，不是显示器刷新率或屏幕呈现延迟。模型下载、ONNX session 创建、初始化、内容检查和截图在计时窗口之外。</p><a download="summary.csv" href="{csv_uri}">下载精确汇总 CSV</a></section>
<section id="phases"><h2>推理完成与渲染完成分项</h2>{phase_table}<p>inferenceWallMs 是 await 原生 ONNXGenerator.generate 的墙钟区间，包含其 count-buffer 读回；renderCompletionMs 记录随后当前帧的预处理、排序、绘制、GPU 完成等待和查询读回。推理后的额外 queue 完成等待、严格count检查和共享buffer绑定检查，以及外层相机/调用/validation开销仍包含在完整 E2E 中，但不在这两个窄分项内。因此不能假设分项总和恰好等于外层 E2E，也不把分项耗时倒数宣传成播放 FPS。</p><h3>真实 WebGPU 阶段查询 · 仅作诊断</h3>{gpu_table}<p class="muted">这些是渲染阶段 GPU timestamp-query 值，不包含完整 ONNX 推理。totalMs 是首个预处理开始至绘制结束的跨度，含阶段间空隙；GPU 查询不能取代完整浏览器墙钟，也不是可与所有 CPU/推理区间直接相加的互斥耗时。</p></section>
<section id="rounds"><h2>每轮结果与完整样本</h2>{round_table}<p>轮 FPS 均值 {fmt(summary["roundFpsMean"])}，样本 SD {fmt(summary["roundFpsSampleSD"])}。主 FPS 使用总样本除以总窗口，与轮 FPS 算术均值含义不同；试跑一轮时不报告样本 SD。</p>{details}</section>
<section id="captures"><h2>四个归一化时刻的实际画面</h2><p>以下4张本次1280×720原始 PNG 经过 SHA 校验后原字节内嵌，可离线查看。相机固定；截图的 inspectCurrent 只读刚渲染的同一代输出，检查推理/渲染代次、buffer身份和有效数一致，不为截图内容证明额外运行一次推理。截图和检查在计时窗口之外执行，不计入吞吐样本。</p><div class="gallery">{gallery}</div><p class="note">模型名称与来源以锁定官方文件身份为准，不从外观反推未证实的训练信息。本实验采样 t=i/149，i=0…149；这些150个归一化时间点是本实验定义，不代表源视频150帧、30 Hz或5秒。</p><p>本次没有与锁定视点匹配的 GT，故不计算 PSNR、SSIM、LPIPS；当前覆盖原生动态速度、时间条件内容变化和画面检查。</p></section>
<section id="native"><h2>原生执行路径、固定协议与变化验收</h2>{table(["项目", "本次协议"], [["引擎 / 推理运行时", "Visionary 1.0.1 / ONNX Runtime Web 1.22.0"], ["执行路径", "ONNXGenerator.generate → 共享GPU输出 → DynamicPointCloud → prepareMulti / renderMulti"], ["资源", "推理和渲染使用同一GPUDevice与共享输出buffer；不做逐帧PLY导出/加载"], ["时间轴", "每轮t=i/149，i=0…149，固定顺序，无跳点，无源FPS声明"], ["重复", f'{protocol["rounds"]}轮 × 150时间点'], ["预热", "首轮至少10秒且至少150帧；轮间至少1.5秒且至少30帧"], ["画面", "1280×720、DPR1、锁定相机；每个时间点使用同一相机"], ["范围", "单模型、单引擎、单固定视点；不推断其他引擎或动态模型性能"]])}<p>会话请求 WebGPU execution provider，适配器检查共享GPUDevice和GPU输出buffer；没有逐节点执行位置证据，因此不宣称ONNX图每个节点都在GPU运行。有效数量的少量读回是本原生路径的一部分。</p><details><summary>实际ORT设备、精度与共享输出设置</summary>{json_box(summary["nativeExecution"])}</details><p>独立审计检查请求时间、推理/渲染代次、共享资源身份、内容变化、阶段查询、供电与清理。预热前，对全部150个请求时刻的所有有效高斯逐点扫描位置、alpha和6个协方差分量；SH颜色另作采样解码。此检查不等于完整模型全部输出逐元素比较，也不能代替语义画面检查。</p><h3>150个时刻的渲染路径数值验收</h3>{sweep_table}<p class="note">所有有效点的XYZ和alpha必须有限，alpha≥0.02的协方差也必须有限。仅允许alpha&lt;0.02、被冻结原生shader在读取协方差之前提前剔除的非有限协方差；原始模型与GPU输出保留，不清洗、不替换。逐异常行的原始字节及原生早退源码SHA由独立审计核验。因此通过验收不代表所有高斯的全部数值都有限。</p><p>上表只汇总150个计时外检查；逐时刻完整证据保存在原始visionary.json和audit.json，不纳入计时FPS。</p><details><summary>实际原生时序、内容与资源验收</summary>{json_box(summary["nativeValidation"])}</details><details><summary>锁定相机与实际模型加载记录（不计入FPS）</summary>{json_box(protocol["camera"])}{json_box(summary["loadInfo"])}</details><h3>模型输出形状与有效数量</h3>{table(["输出名", "ONNX数据类型编号", "输出shape / capacity"], capacity_rows)}{table(["实际计时样本", "最小", "最大"], [["num_points有效高斯", summary["activeGaussianCount"]["min"], summary["activeGaussianCount"]["max"]], ["可见高斯", summary["visibleGaussianCount"]["min"], summary["visibleGaussianCount"]["max"]]])}<p>输出缓冲区有填充容量，容量不是有效高斯数。有效数量以原生 num_points buffer 的实际读取及审计记录为准；不能把输出shape中的容量槽位当作活动高斯数。</p><details><summary>本次GPU内容检查原始记录</summary>{json_box(summary["contentInspections"])}</details><p>采样直接给原生生成器传入固定时间，保证重复轮次请求同一内容序列；不沿用交互 UI 自由运行的墙钟动画节奏。推理与渲染源码保持上游版本，完成等待、计时与检查由本实验适配器执行。</p></section>
<section id="environment"><h2>实际机器、浏览器与供电</h2>{table(["字段", "运行记录"], host_rows)}<details><summary>实际WebGPU adapter</summary>{json_box(summary["environment"]["gpuAdapter"])}</details>{table(["供电检查", "记录"], [["周期遥测样本数", summary["power"]["sampleCount"]], ["首次记录", summary["power"]["firstAt"]], ["最后记录", summary["power"]["lastAt"]], ["全程观察值", "AC Power；审计已检查记录，不改变系统设置"]])}<p>不同 Mac 的 CPU、内存、macOS、Chrome、温度和电源条件均可能影响结果；不能把差异全部归因于 GPU 芯片。主机源码提交：<code>{esc(summary["sourceCommit"])}</code>。</p></section>
<section id="evidence"><h2>公开来源、验收与分享</h2><p><a href="https://github.com/Visionary-Laboratory/visionary">Visionary 官方项目</a> · <a href="{esc(model_link)}">锁定官方模型文件入口</a> · <a href="https://github.com/microsoft/onnxruntime">ONNX Runtime</a></p><p>官方模型由 model-lock.json 固定文件大小和 SHA256。代码上游许可与模型许可分别保留：公开下载入口不等于模型另获代码许可证授权；模型不提交到本仓库。未确认的场景名、源时长或源帧率不作推断。</p><details><summary>本次模型身份与ONNX输入输出元数据</summary>{json_box(summary["modelLock"])}{json_box(summary["modelInfo"])}</details><details><summary>运行期已分类警告与原始诊断</summary><p>仅采集器明确分类的已知ORT常量折叠警告记录为warnings；其他运行错误仍使采集/审计失败。警告保留原文，不伪装成空日志。</p>{json_box(summary["rawDiagnostics"])}</details><p>本报告只在完整独立 audit.json 通过后生成，重新检查绑定来源的当前 SHA，并从原始样本独立重算 FPS、分位数与分项。报告生成器没有运行GPU，也不把生成成功当作已完成目视审核。</p><p>本 HTML 内嵌全部4张PNG、样式与可下载汇总CSV，可单文件离线分享。旁边的 summary.json、summary.csv、samples.csv、REPORT.txt 和 build-receipt.json 保存精确数值与输出身份；完整原始证据仍在父目录，轻量HTML不代替该证据目录。</p><div class="hash">protocol SHA256: {esc(summary["protocolSha256"])}<br>audit SHA256: {esc(summary["auditSha256"])}<br>model SHA256: {esc(summary["modelLock"].get("sha256"))}</div></section></main></body></html>'''


def build(run):
    state = inspect_run(run)
    protocol, record, audit = state["protocol"], state["record"], state["audit"]
    inputs = [identity(path) for path in state["inputs"]]
    round_fps = [row["completedFramesPerSecond"] for row in state["rounds"]]
    audit_record = audit["records"][0]
    sweep_summary = content_sweep_summary(record, audit_record)
    native_validation = {key: value for key, value in audit_record.items() if key not in ("e2e", "phases", "rounds", "captures")}
    native_validation["contentValidation"] = {key: value for key, value in audit_record["contentValidation"].items() if key != "fullContentSweep"}
    native_validation["contentValidation"]["fullContentSweepSummary"] = sweep_summary
    active_counts = [sample.get("actualCount", sample.get("gaussianCount")) for sample in state["samples"]]
    visible_counts = [sample.get("visibleSplats") for sample in state["samples"]]
    require(all(type(n) is int and n > 0 for n in active_counts), "Missing actual GPU num_points samples")
    require(all(type(n) is int and 0 <= n <= active for n, active in zip(visible_counts, active_counts)), "Invalid visible Gaussian counts")
    summary = {"schema": "visionary-native-4dgs-report-v1", "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
               "mode": protocol["mode"], "collectionComplete": True, "independentAuditPassed": True,
               "visualReviewPerformedByGenerator": False, "method": "visionary", "engineVersion": "1.0.1", "ortVersion": "1.22.0",
               "modelName": protocol["modelLock"].get("name", protocol["modelLock"].get("filename")),
               "sceneName": protocol["modelLock"].get("sceneName"), "sceneNameNote": "Use locked official file identity; no source FPS/duration is inferred",
               "sceneIdentityNote": protocol["modelLock"].get("sceneIdentityNote"),
               "e2e": state["e2e"], "phases": state["phases"], "gpuDiagnostics": state["gpu"], "rounds": state["rounds"],
               "roundFpsMean": statistics.fmean(round_fps), "roundFpsSampleSD": statistics.stdev(round_fps) if len(round_fps) > 1 else None,
               "protocol": {key: protocol[key] for key in ("width", "height", "dpr", "rounds", "framesPerRound", "timeSampling", "camera", "measurement", "warmup", "betweenRounds")},
               "modelLock": protocol["modelLock"], "modelInfo": protocol["modelInfo"], "loadInfo": record["loadInfo"],
               "nativeValidation": native_validation, "contentSweep": sweep_summary,
               "nativeExecution": {key: record["metadata"].get(key) for key in ("ortVersion", "ortExecutionProvidersRequested", "ortDeviceShared", "ortNodePlacementVerified", "ortProviderEvidence", "graphCaptureEnabled", "graphCaptureFallbackObserved", "capacity", "colorChannels", "shDegree", "gaussianPrecision", "colorPrecision")},
               "rawDiagnostics": {"warnings": record.get("warnings", []), "runtimeEvents": record.get("metadata", {}).get("events", []), "initializationAlerts": record.get("metadata", {}).get("initializationAlerts", [])},
               "activeGaussianCount": {"min": min(active_counts), "max": max(active_counts)},
               "visibleGaussianCount": {"min": min(visible_counts), "max": max(visible_counts)},
               "contentInspections": {"initial": record.get("inspectionStart"), "captures": [{"index": c["index"], "time": c["time"], "inspection": c["inspection"]} for c in state["captures"]]},
               "environment": environment(protocol, record), "power": {"sampleCount": len(state["telemetry"]["samples"]),
                   "firstAt": state["telemetry"]["samples"][0].get("at"), "lastAt": state["telemetry"]["samples"][-1].get("at"), "allObservedAc": True},
               "captures": [{key: value for key, value in c.items() if key not in ("dataUri", "inspection")} for c in state["captures"]],
               "sourceCommit": protocol.get("revision"), "protocolSha256": sha(run / "protocol.json"), "auditSha256": sha(run / "audit.json"),
               "definitions": {"fps": "1000 * measured completed samples / sum round.windowElapsedMs", "percentile": "Type7 on every measured E2E sample",
                               "time": "Experiment-defined normalized t=i/149, i=0..149; not source frame rate", "presentation": "No screen presentation latency measurement",
                               "excluded": "model fetch, session initialization, warmup, content inspections, captures", "quality": "No matched-view GT; no PSNR/SSIM/LPIPS"}}
    fields = ["method", "samples", "completed_fps", "e2e_mean_ms", "e2e_p50_ms", "e2e_p95_ms", "inference_mean_ms", "inference_p50_ms", "inference_p95_ms", "render_completion_mean_ms", "render_completion_p50_ms", "render_completion_p95_ms"]
    values = ["visionary", summary["e2e"]["sampleCount"], summary["e2e"]["completedFramesPerSecond"],
              *[summary["e2e"][key] for key in ("meanMs", "p50Ms", "p95Ms")],
              *[summary["phases"][phase][key] for phase in PHASES for key in ("meanMs", "p50Ms", "p95Ms")]]
    csv_summary = make_csv(fields, [dict(zip(fields, values))])
    sample_fields = ["repeat", "index", "requestedTime", "e2eCompletionMs", *PHASES, "e2eStartMs", "e2eEndMs"]
    samples_csv = make_csv(sample_fields, [{key: row[key] for key in sample_fields} for row in state["samples"]])
    files = {"index.html": html_report(summary, state, csv_summary), "summary.json": json.dumps(summary, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
             "summary.csv": csv_summary, "samples.csv": samples_csv,
             "REPORT.txt": "打开 index.html：该文件内嵌4张本次原始PNG、样式、可下载汇总CSV，可单文件离线分享。\nsummary.json/summary.csv/samples.csv保存实际数值；build-receipt.json绑定来源与输出。\n这是Visionary原生ONNX推理到渲染完成吞吐，不是屏幕呈现FPS。150个归一化t是实验采样，不代表源视频帧率或时长。\n原始协议/逐帧时钟/资源/供电/清理/独立审计证据仍在父目录；生成报告不等于完成目视检查。\n"}
    output = run / "analysis"
    require(not output.is_symlink(), "Refusing symlink analysis directory")
    output.mkdir(exist_ok=True)
    for name, content in files.items():
        target = output / name
        require(not target.is_symlink(), f"Refusing symlink report output: {name}")
        target.write_text(content, encoding="utf-8")
    require(all(identity(Path(row["path"])) == row for row in inputs), "Report source changed during generation")
    receipt = {"schema": "visionary-native-4dgs-report-build-v1", "passed": True, "complete": True, "mode": protocol["mode"],
               "createdAt": summary["generatedAt"], "sourceCommit": protocol.get("revision"), "sourceFiles": inputs,
               "generator": identity(Path(__file__)), "inlineCaptureCount": 4, "selfContainedHtml": True, "visualReviewPerformed": False,
               "outputs": [{"path": name, "bytes": (output / name).stat().st_size, "sha256": sha(output / name)} for name in files]}
    target = output / "build-receipt.json"
    require(not target.is_symlink(), "Refusing symlink build receipt")
    target.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "mode": protocol["mode"], "samples": state["e2e"]["sampleCount"], "report": str(output / "index.html")}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=Path, help="Complete native pilot/formal directory with current passed audit.json")
    args = parser.parse_args()
    build(args.run.expanduser().resolve())


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

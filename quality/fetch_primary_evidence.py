"""Small provenance snapshots; run on ecofde using its configured HTTPS proxy."""
import argparse, hashlib, json, pathlib, subprocess
from acquire_ground_truth import save, stamp


def fetch(url, path):
    subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '8', '--retry-all-errors',
                    '--max-time', '90', '--max-filesize', '2000000', '--output', str(path), url], check=True)
    return dict(url=url, file=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--output', type=pathlib.Path, required=True)
    ap.add_argument('--network-node', choices=['ecofde'], required=True)
    args = ap.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    import platform
    if platform.system() == 'Darwin': raise ValueError('Run network retrieval on ecofde, then transfer the evidence')
    entries = []
    entries.append(fetch('https://jonbarron.info/mipnerf360/', args.output / 'mipnerf360.html'))
    for repo, ref, prefix, paths in [
        ('graphdeco-inria/gaussian-splatting', 'main', 'graphdeco', ['README.md', 'metrics.py', 'utils/loss_utils.py', 'utils/image_utils.py', 'utils/general_utils.py']),
        ('richzhang/PerceptualSimilarity', 'master', 'lpips', ['README.md', 'lpips/lpips.py'])]:
        commit_file = args.output / (prefix + '-commit.json')
        entries.append(fetch(f'https://api.github.com/repos/{repo}/commits/{ref}', commit_file))
        commit = json.loads(commit_file.read_text())['sha']
        for path in paths:
            entries.append(fetch(f'https://raw.githubusercontent.com/{repo}/{commit}/{path}',
                                 args.output / (prefix + '-' + path.replace('/', '-'))))
    save(args.output / 'primary-source-receipt.json', dict(created_at=stamp(), entries=entries,
        network_node='ecofde', note='Primary dataset/metric references; runtime code versions are separately pinned in requirements and metrics protocol'))


if __name__ == '__main__': main()

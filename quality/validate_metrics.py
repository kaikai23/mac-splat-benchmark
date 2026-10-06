"""Small CPU-only numerical validation. Run only during an idle timing window."""
from __future__ import annotations
import argparse, math, os, pathlib
from acquire_ground_truth import save, stamp
from measure_quality import pixel_psnr, ssim_torch, sha, VGG_CHECKPOINT_SHA256


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output', type=pathlib.Path, required=True)
    ap.add_argument('--torch-home', type=pathlib.Path)
    ap.add_argument('--include-lpips', action='store_true')
    args = ap.parse_args()
    import numpy as np
    import torch
    from scipy.signal import convolve2d
    torch.set_num_threads(2); torch.set_grad_enabled(False)
    rng = np.random.default_rng(1973)
    a8 = rng.integers(0, 256, (48, 64, 3), dtype=np.uint8)
    zero = np.zeros((48, 64, 3), dtype=np.uint8)
    assert pixel_psnr(a8, a8) == (None, True)
    p, inf = pixel_psnr(zero, np.ones_like(zero))
    assert not inf and abs(p - 20 * math.log10(255)) < 1e-10
    p, inf = pixel_psnr(zero, np.full_like(zero, 255))
    assert p == 0 and not inf
    b8 = np.roll(a8, 1, axis=1)
    a = torch.from_numpy(a8).permute(2, 0, 1)[None].float() / 255
    b = torch.from_numpy(b8).permute(2, 0, 1)[None].float() / 255
    assert abs(ssim_torch(a, a) - 1) < 1e-6
    # Independent scipy float64 correlation checks border handling and RGB mean.
    w = np.exp(-np.arange(-5, 6, dtype=np.float64) ** 2 / (2 * 1.5 ** 2)); w /= w.sum()
    kernel = np.outer(w, w)
    scores = []
    for channel in range(3):
        x, y = a8[..., channel].astype(np.float64) / 255, b8[..., channel].astype(np.float64) / 255
        blur = lambda z: convolve2d(z, kernel, mode='same', boundary='fill', fillvalue=0)
        u, v = blur(x), blur(y)
        vx, vy, c = blur(x * x) - u * u, blur(y * y) - v * v, blur(x * y) - u * v
        scores.append(np.mean(((2 * u * v + .01 ** 2) * (2 * c + .03 ** 2)) /
                             ((u * u + v * v + .01 ** 2) * (vx + vy + .03 ** 2))))
    reference = float(np.mean(scores)); actual = ssim_torch(a, b)
    assert abs(reference - actual) < 2e-6, (reference, actual)
    checks = dict(psnr_analytic=True, psnr_identity=True, ssim_identity=True,
                  ssim_independent_scipy=True, ssim_reference=reference,
                  ssim_actual=actual, ssim_abs_error=abs(reference - actual), lpips=None)
    if args.include_lpips:
        if args.torch_home is None: raise ValueError('--torch-home required for LPIPS')
        os.environ['TORCH_HOME'] = str(args.torch_home.resolve())
        path = args.torch_home / 'hub/checkpoints/vgg16-397923af.pth'
        if not path.is_file() or sha(path) != VGG_CHECKPOINT_SHA256:
            raise ValueError('Local VGG checkpoint missing/incorrect; offline validation only')
        import lpips
        model = lpips.LPIPS(net='vgg', version='0.1', verbose=False).eval().cpu()
        identity = float(model(a, a, normalize=True).item())
        distance = float(model(a, b, normalize=True).item())
        reverse = float(model(b, a, normalize=True).item())
        assert abs(identity) < 1e-7 and distance > 0 and abs(reverse - distance) < 1e-6
        checks['lpips'] = dict(identity=identity, changed=distance, reversed=reverse,
                               checkpoint_sha256=sha(path), passed=True)
    save(args.output, dict(schema='mac-quality-numerical-validation-v1', device='cpu',
         generated_at=stamp(), complete=args.include_lpips, checks=checks,
         metrics_script_sha256=sha(pathlib.Path(__file__).with_name('measure_quality.py')),
         validation_script_sha256=sha(pathlib.Path(__file__))))
    print(checks)


if __name__ == '__main__': main()

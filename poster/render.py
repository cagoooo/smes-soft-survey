# -*- coding: utf-8 -*-
"""用 Playwright 把 poster.html 的 .poster 元素截成高解析 PNG。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
html = (HERE / "poster.html").as_uri()
out = HERE / "poster.png"

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(device_scale_factor=2, viewport={"width": 1120, "height": 1600})
    page.goto(html)
    page.wait_for_timeout(400)          # 等字體與 QR 載入
    el = page.query_selector(".poster")
    el.screenshot(path=str(out))
    b.close()

print("poster saved:", out)

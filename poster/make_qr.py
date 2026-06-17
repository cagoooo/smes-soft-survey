# -*- coding: utf-8 -*-
"""生成填報網站 QR Code（高容錯、深青底色，掃描穩定）。"""
import qrcode
from qrcode.constants import ERROR_CORRECT_H

URL = "https://cagoooo.github.io/smes-soft-survey/"

qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,   # 30% 容錯，留邊裁切也能掃
    box_size=20,
    border=2,
)
qr.add_data(URL)
qr.make(fit=True)

img = qr.make_image(fill_color="#0b3a36", back_color="#ffffff").convert("RGB")
out = r"H:\Software\smes-survey\poster\qr.png"
img.save(out)
print("QR saved:", out, img.size)

#!/usr/bin/env python3
import ssl
import os
import subprocess
import ipaddress
from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def generate_self_signed_cert():
    print("🔐 生成SSL证书")
    print("=" * 60)

    cert_file = "server.crt"
    key_file = "server.key"

    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("✅ 证书已存在，跳过生成")
        print(f"  证书: {cert_file}")
        print(f"  私钥: {key_file}")
        return True

    try:
        print("🔧 正在生成私钥...")
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )

        print("🔧 正在生成证书...")
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Local"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Local"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Camera Server"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.now(timezone.utc)
        ).not_valid_after(
            datetime.now(timezone.utc) + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("127.0.0.1"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())

        with open(key_file, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))

        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        print("=" * 60)
        print("✅ 证书生成成功!")
        print("=" * 60)
        print("📁 证书文件:")
        print(f"  {cert_file}")
        print(f"  {key_file}")
        print("\n📢 使用说明:")
        print("  1. 启动服务器: python server.py")
        print("  2. 访问: https://[您的IP]:8000")
        print("  3. 首次访问需信任证书")
        print("  4. 证书有效期: 365天")
        print("=" * 60)
        return True
    except ImportError as e:
        print("❌ 缺少cryptography库")
        print("请安装: pip install cryptography")
        return False
    except Exception as e:
        print(f"❌ 生成证书失败: {e}")
        return False


if __name__ == "__main__":
    generate_self_signed_cert()
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class TotpService {
  static generateSecret(email: string): { secret: string; otpauthUrl: string } {
    const generated = speakeasy.generateSecret({
      name: `GlamStock (${email})`,
      issuer: 'GlamStock',
      length: 32,
    });
    return {
      secret: generated.base32,
      otpauthUrl: generated.otpauth_url!,
    };
  }

  static async generateQrDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  static verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
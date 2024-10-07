import { Injectable } from '@angular/core';
import QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class QrCodeGeneratorService  {

  constructor() { }

  async generateQrCode(text: string): Promise<string> {
    try {
      const dataUrl = await QRCode.toDataURL(text, { width: 200, margin: 2 });
      return dataUrl.replace(/^data:image\/png;base64,/, '');  // Strip the prefix
    } catch (error) {
      console.error('QR code generation failed', error);
      throw error;
    }
  }
}

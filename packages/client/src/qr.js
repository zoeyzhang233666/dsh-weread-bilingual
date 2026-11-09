import QRCode from 'qrcode'

export async function qrDataUrlFromText(text) {
  return QRCode.toDataURL(String(text || ''), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
    color: { dark: '#1f1b16', light: '#ffffff' },
  })
}

export function qrPayload(text, o) {
  const value = text.trim(),
    escape = (s) => s.replace(/([\\;,:"])/g, '\\$1');
  if (o.preset === 'wifi') return `WIFI:T:WPA;S:${escape(value)};P:${escape(o.password || '')};;`;
  if (o.preset === 'contact') {
    const lines = value.split(/\r?\n/);
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${escape(lines[0])}\nTEL:${escape(lines[1] || '')}\nEMAIL:${escape(lines[2] || '')}\nEND:VCARD`;
  }
  if (o.preset === 'email') return `mailto:${value}?subject=${encodeURIComponent(o.subject || '')}`;
  if (o.preset === 'sms') return `SMSTO:${value}:${o.subject || ''}`;
  if (o.preset === 'whatsapp') {
    const phone = value.replace(/[+\s()-]/g, '');
    if (!/^\d{6,15}$/.test(phone))
      throw new Error('Enter a WhatsApp phone number with country code.');
    return `https://wa.me/${phone}?text=${encodeURIComponent(o.subject || '')}`;
  }
  return value;
}

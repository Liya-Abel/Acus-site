/**
 * Cloudflare Worker — обработчик формы acusdom.ru
 *
 * Environment variables (Settings → Variables → Encrypt):
 *   TG_TOKEN   — токен бота от @BotFather
 *   TG_CHAT_ID — числовой chat_id получателя (личка или группа)
 *   EMAIL      — acusdom@mail.ru
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': 'https://acusdom.ru',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Not allowed', { status: 405, headers: cors });
    }

    try {
      const fd = await request.formData();

      // Honeypot — боты заполняют это поле
      if (fd.get('_honey')) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const name    = (fd.get('Имя')       || '—').trim();
      const contact = (fd.get('Контакт')   || '—').trim();
      const service = (fd.get('Услуга')    || '—').trim();
      const comment = (fd.get('Комментарий') || '').trim();
      const calc    = (fd.get('Расчёт из калькулятора') || '').trim();

      // ── Telegram ──────────────────────────────────────────────
      let msg = '🏠 Новая заявка — acusdom.ru\n\n';
      msg += `👤 Имя: ${name}\n`;
      msg += `📞 Контакт: ${contact}\n`;
      msg += `🔧 Услуга: ${service}\n`;
      if (comment) msg += `💬 Задача: ${comment}\n`;
      if (calc)    msg += `\n🧮 Расчёт:\n${calc}\n`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: msg }),
        }
      );

      if (!tgRes.ok) {
        const tgErr = await tgRes.text();
        throw new Error(`Telegram: ${tgRes.status} — ${tgErr}`);
      }

      // ── Email через formsubmit.co (дублирование, best-effort) ─
      try {
        const emailFd = new FormData();
        emailFd.append('Имя', name);
        emailFd.append('Контакт', contact);
        emailFd.append('Услуга', service);
        if (comment) emailFd.append('Комментарий', comment);
        if (calc)    emailFd.append('Расчёт из калькулятора', calc);
        emailFd.append('_subject', `Заявка с сайта: ${name}, ${service}`);
        emailFd.append('_captcha', 'false');

        await fetch(`https://formsubmit.co/${env.EMAIL}`, {
          method: 'POST',
          body: emailFd,
        });
      } catch (_) {
        // email — не блокируем ответ если упало
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};

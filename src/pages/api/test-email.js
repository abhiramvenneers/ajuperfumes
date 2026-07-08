export const prerender = false;

export async function GET({ request }) {
    const url = new URL(request.url);
    const toEmail = url.searchParams.get('to');

    // 1. Check both possible environments for the API Key
    const keyFromMeta = import.meta.env.RESEND_API_KEY;
    const keyFromProcess = process.env.RESEND_API_KEY;
    const RESEND_API_KEY = keyFromMeta || keyFromProcess;

    if (!toEmail) {
        return new Response(JSON.stringify({
            status: "Error",
            message: "Missing 'to' parameter in URL. Please use: /api/test-email?to=your-registered-email@gmail.com"
        }, null, 2), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const diagnostics = {
        metaEnvKeyFound: !!keyFromMeta,
        processEnvKeyFound: !!keyFromProcess,
        resolvedKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0,
        maskedKey: RESEND_API_KEY ? `${RESEND_API_KEY.substring(0, 5)}...${RESEND_API_KEY.substring(RESEND_API_KEY.length - 4)}` : "None"
    };

    if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({
            status: "Failed",
            diagnostics,
            message: "RESEND_API_KEY is not defined in your environment variables. Make sure it is in your .env file at the project root and restart your dev server."
        }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Aju Perfumes <onboarding@resend.dev>',
                to: [toEmail],
                subject: 'Diagnostic Test - Aju Perfumes',
                html: '<h3>Your Email Integration is working!</h3>'
            })
        });

        const resData = await res.json();

        return new Response(JSON.stringify({
            status: res.ok ? "Success" : "Failed",
            httpStatusCode: res.status,
            diagnostics,
            resendApiResponse: resData,
            note: "If status is Failed with a 403, you are trying to send to an unverified email in Sandbox. Use your Resend signup email."
        }, null, 2), { status: res.status, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({
            status: "Failed",
            diagnostics,
            error: error.message
        }, null, 2), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
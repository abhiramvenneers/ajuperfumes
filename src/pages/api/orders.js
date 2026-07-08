import { supabase } from '../../lib/supabase.js';

export const prerender = false;

// Helper function to send status update emails
async function sendStatusEmail(toEmail, status) {
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY; 
    if (!RESEND_API_KEY) return;

    let subject = "";
    let message = "";

    if (status === 'accepted') {
        subject = "Order Accepted - Aju Perfumes";
        message = "Great news! We have accepted your order and are preparing it right now.";
    } else if (status === 'shipped') {
        subject = "Order Shipped! - Aju Perfumes";
        message = "Your signature scent is on its way! Your order has been dispatched and handed over to our delivery partners.";
    } else {
        return; // Don't send emails for other random statuses
    }

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Aju Perfumes <orders@ajuperfumes.com>', // Verified Branded Email Address
                to: [toEmail],
                subject: subject,
                html: `<div style="font-family: sans-serif; color: #333;"><h2>Update on your order</h2><p>${message}</p><p>Track your shipment at any time through your <a href="https://ajuperfumes.com/account">Aju Perfumes Client Space</a>.</p></div>`
            })
        });
    } catch (error) {
        console.error("Email Notification Error:", error);
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { action, id, status } = body;

        if (action === 'updateStatus') {
            // 1. Update the status in the database
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);
            if (error) throw error;
            
            // 2. Fetch the order details to get the customer's email address
            const { data: orderData } = await supabase.from('orders').select('customer_email').eq('id', id).single();
            
            // 3. Send the notification email
            if (orderData && orderData.customer_email) {
                await sendStatusEmail(orderData.customer_email, status);
            }

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: "Invalid action" }), { status: 400 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
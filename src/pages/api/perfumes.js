    import { supabase } from '../../lib/supabase.js';

    export const prerender = false;

    export async function POST({ request }) {
        try {
            const body = await request.json();
            
            // Destructure 'category' from the incoming request body
            const { action, id, name, price, stock, volume, notes, image_url, category } = body;

            // Build the data object, ensuring category is included
            const productData = { 
                name, 
                price: parseFloat(price), 
                stock_quantity: parseInt(stock),
                volume: volume || 'N/A',
                notes: notes || 'N/A',
                image_url: image_url,
                category: category || 'Classic' // Save the category, default to Classic if missing
            };

            if (action === 'add') {
                const { error } = await supabase.from('perfumes').insert([productData]);
                
                if (error) {
                    console.error("Supabase Insert Error:", error);
                    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
                }
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }

            if (action === 'edit') {
                // Update the perfume matching the ID with all the productData (including category)
                const { error } = await supabase.from('perfumes').update(productData).eq('id', id);

                if (error) {
                    console.error("Supabase Update Error:", error);
                    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
                }
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }

            if (action === 'delete') {
                const { error } = await supabase.from('perfumes').delete().eq('id', id);
                return new Response(JSON.stringify({ success: !error, error }), { status: error ? 500 : 200 });
            }

            return new Response(JSON.stringify({ message: "Invalid action" }), { status: 400 });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }
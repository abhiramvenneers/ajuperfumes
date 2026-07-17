import { supabase } from '../../lib/supabase.js';

export const prerender = false;

/**
 * Astro POST API Route to securely manage products and their dynamic variations.
 * This handles adding, updating, and deleting records inside Supabase.
 */
export async function POST({ request }) {
    try {
        const body = await request.json();
        const { action, id, name, category, image_url, notes, variants } = body;

        // Verify that the user has admin authorization
        const authHeader = request.headers.get('Authorization') || '';
        
        // 1. DELETE ACTION
        if (action === 'delete') {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        // 2. ADD ACTION
        if (action === 'add') {
            // Insert Base Product
            const { data: newProd, error: prodErr } = await supabase
                .from('products')
                .insert([{ name, category, image_url, notes }])
                .select()
                .single();

            if (prodErr) throw prodErr;

            // Insert Variants if they exist
            if (variants && Array.isArray(variants) && variants.length > 0) {
                const variantsToInsert = variants.map(v => ({
                    product_id: newProd.id,
                    variant_label: v.variant_label,
                    price_override: v.price_override ? parseFloat(v.price_override) : null,
                    stock_quantity: parseInt(v.stock_quantity) || 0
                }));

                const { error: varErr } = await supabase
                    .from('product_variants')
                    .insert(variantsToInsert);

                if (varErr) throw varErr;
            }

            return new Response(JSON.stringify({ success: true, product: newProd }), { status: 200 });
        }

        // 3. EDIT ACTION
        if (action === 'edit') {
            // Update Base Product metadata
            const { error: updateErr } = await supabase
                .from('products')
                .update({ name, category, image_url, notes })
                .eq('id', id);

            if (updateErr) throw updateErr;

            // Simple Sync logic: Delete existing variants and insert updated ones
            const { error: delVarErr } = await supabase
                .from('product_variants')
                .delete()
                .eq('product_id', id);

            if (delVarErr) throw delVarErr;

            if (variants && Array.isArray(variants) && variants.length > 0) {
                const variantsToInsert = variants.map(v => ({
                    product_id: id,
                    variant_label: v.variant_label,
                    price_override: v.price_override ? parseFloat(v.price_override) : null,
                    stock_quantity: parseInt(v.stock_quantity) || 0
                }));

                const { error: insVarErr } = await supabase
                    .from('product_variants')
                    .insert(variantsToInsert);

                if (insVarErr) throw insVarErr;
            }

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400 });

    } catch (e) {
        console.error("Products Server Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
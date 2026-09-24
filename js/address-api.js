(() => {
    const supabase = window.datihanSupabase;

    const requireUser = async () => {
        if (!supabase) throw new Error('Supabase client is not available.');

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user?.id) throw new Error('Your session has expired. Please log in again.');

        return { session: data.session, user: data.session.user };
    };

    const getAll = async () => {
        const { user } = await requireUser();
        const { data, error } = await supabase
            .from('saved_addresses')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    const create = async payload => {
        const { user } = await requireUser();
        const row = { ...payload, user_id: user.id };
        if (row.is_default) {
            const { error } = await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id);
            if (error) throw error;
        }
        const { data, error } = await supabase.from('saved_addresses').insert(row).select().single();
        if (error) throw error;
        return data;
    };

    const update = async (id, payload) => {
        const { user } = await requireUser();
        if (payload.is_default) {
            const { error } = await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id);
            if (error) throw error;
        }
        const { data, error } = await supabase.from('saved_addresses').update(payload).eq('id', id).eq('user_id', user.id).select().single();
        if (error) throw error;
        return data;
    };

    const remove = async id => {
        const { user } = await requireUser();
        const { error } = await supabase.from('saved_addresses').delete().eq('id', id).eq('user_id', user.id);
        if (error) throw error;
    };

    const setDefault = async id => {
        const { user } = await requireUser();
        const { error: clearError } = await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id);
        if (clearError) throw clearError;
        const { error } = await supabase.from('saved_addresses').update({ is_default: true }).eq('id', id).eq('user_id', user.id);
        if (error) throw error;
    };

    window.DatihanAddressAPI = { getAll, create, update, remove, setDefault };
})();

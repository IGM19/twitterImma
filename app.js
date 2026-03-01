// Inicializar Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Identidad ---
function getDeviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('device_id', id);
    }
    return id;
}

const myDeviceId = getDeviceId();

// Sistema de Navegación Simple (SPA)
const routes = {
    '': renderFeed,
    'new': renderCreatePost
};

function router() {
    const hash = window.location.hash.slice(1); // Elimina el #
    const view = routes[hash] || routes['']; // Por defecto al feed
    view();
}

// Escuchar cambios en la URL (al hacer clic en los enlaces de navegación)
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// --- Vistas ---

async function renderFeed() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="view">
            <div id="posts-feed" class="feed-container">
                <div class="loader">Espere un momento...</div>
            </div>
        </div>
    `;
    loadPosts();
}

async function loadPosts() {
    const feedContainer = document.getElementById('posts-feed');

    try {
        // Traer posts y contar likes
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select(`
                *,
                likes (device_id)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (posts.length === 0) {
            feedContainer.innerHTML = '<p class="empty-msg">Nadie ha susurrado nada aún. ¡Sé el primero!</p>';
            return;
        }

        feedContainer.innerHTML = posts.map(post => {
            const isLiked = post.likes.some(l => l.device_id === myDeviceId);
            const isAuthor = post.author_id === myDeviceId;

            return `
                <div class="post-card" id="post-${post.id}">
                    <div class="post-header">
                        <span class="author-tag">@${post.author_id.slice(-4)}</span>
                        ${isAuthor ? `<button class="delete-btn" onclick="deletePost('${post.id}')">🗑️</button>` : ''}
                    </div>
                    <p class="post-content">${post.content}</p>
                    <div class="post-footer">
                        <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', ${isLiked})">
                            ${isLiked ? '❤️' : '🤍'} <span>${post.likes.length}</span>
                        </button>
                        <span class="post-time">${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        feedContainer.innerHTML = '<p class="error-msg">Error al cargar el feed.</p>';
    }
}

async function toggleLike(postId, alreadyLiked) {
    try {
        if (alreadyLiked) {
            await supabaseClient
                .from('likes')
                .delete()
                .match({ post_id: postId, device_id: myDeviceId });
        } else {
            await supabaseClient
                .from('likes')
                .insert([{ post_id: postId, device_id: myDeviceId }]);
        }
        loadPosts(); // Recargar para actualizar contadores
    } catch (err) {
        console.error(err);
    }
}

async function deletePost(postId) {
    if (!confirm("¿Seguro que quieres borrar este susurro?")) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .match({ id: postId, author_id: myDeviceId });

        if (error) throw error;
        loadPosts();
    } catch (err) {
        console.error(err);
        alert("No se pudo borrar el post.");
    }
}

function renderCreatePost() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="view create-post-card">
            <h2>✨ Nuevo Susurro</h2>
            <textarea id="post-content" placeholder="¿Qué tienes en mente?" maxlength="280"></textarea>
            <div class="actions">
                <button onclick="publishPost()" id="publish-btn">Publicar</button>
            </div>
            <div id="form-message"></div>
        </div>
    `;
}

async function publishPost() {
    const content = document.getElementById('post-content').value.trim();
    const btn = document.getElementById('publish-btn');
    const msg = document.getElementById('form-message');

    if (!content) return;

    btn.disabled = true;
    btn.innerText = "Publicando...";

    try {
        const { error } = await supabaseClient
            .from('posts')
            .insert([
                {
                    content: content,
                    author_id: myDeviceId
                }
            ]);

        if (error) throw error;

        msg.innerHTML = "¡Publicado con éxito! 🚀";
        msg.style.color = "green";

        setTimeout(() => {
            window.location.hash = ""; // Volver al feed
        }, 1500);

    } catch (err) {
        console.error(err);
        msg.innerHTML = "Error al publicar. Revisa la consola.";
        msg.style.color = "red";
        btn.disabled = false;
        btn.innerText = "Publicar";
    }
}

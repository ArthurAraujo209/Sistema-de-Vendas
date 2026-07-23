const IMGBB_API_KEY = '8eb301a696654f7b9429c2be6375e3b0'; // ← cole sua chave aqui

/**
 * Faz upload de uma imagem para o ImgBB e retorna a URL.
 * @param {File} file - Arquivo de imagem selecionado
 * @returns {Promise<string>} URL da imagem
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Falha no upload da imagem');
  }

  const data = await response.json();
  return data.data.url;
}
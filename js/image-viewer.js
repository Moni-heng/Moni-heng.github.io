// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const postImages = document.querySelectorAll('.post-content img'); // 文章中的所有图片

  // 为每张图片添加点击事件
  postImages.forEach(img => {
    img.style.cursor = 'zoom-in'; // 鼠标悬停时显示放大图标
    img.addEventListener('click', function() {
      modalImg.src = this.src; // 设置预览图片地址
      modal.classList.add('active'); // 显示模态框并模糊背景
      document.body.style.overflow = 'hidden'; // 禁止背景滚动
    });
  });

  // 点击模态框关闭预览
  modal.addEventListener('click', function(e) {
    if (e.target === modal) { // 点击背景关闭，点击图片本身不关闭
      modal.classList.remove('active');
      document.body.style.overflow = ''; // 恢复滚动
    }
  });

  // 按ESC键关闭预览
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

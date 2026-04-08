import React, { useRef, useEffect } from 'react';
import './ApplianceDimensionsPreview.css';

const ApplianceDimensionsPreview = ({ width, height, name }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    const ctx = canvas.getContext('2d');
    const padding = 40;
    const maxWidth = 400;
    const maxHeight = 300;
    
    // Вычисляем масштаб
    const scaleX = (maxWidth - padding * 2) / width;
    const scaleY = (maxHeight - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем, только уменьшаем
    
    const displayWidth = width * scale;
    const displayHeight = height * scale;
    
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    
    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Фон
    ctx.fillStyle = '#d4d8dd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Центрируем фигуру
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const x = centerX - displayWidth / 2;
    const y = centerY - displayHeight / 2;
    
    // Рисуем прямоугольник прибора
    ctx.strokeStyle = '#5a6fd8';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, displayWidth, displayHeight);
    
    // Заливка с прозрачностью
    ctx.fillStyle = 'rgba(90, 111, 216, 0.1)';
    ctx.fillRect(x, y, displayWidth, displayHeight);
    
    // Рисуем размеры
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    
    // Размер по ширине (сверху)
    const topY = y - 10;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + displayWidth, topY);
    ctx.stroke();
    
    // Стрелки для ширины
    ctx.beginPath();
    ctx.moveTo(x, topY - 5);
    ctx.lineTo(x, topY);
    ctx.lineTo(x - 3, topY - 3);
    ctx.moveTo(x, topY);
    ctx.lineTo(x + 3, topY - 3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + displayWidth, topY - 5);
    ctx.lineTo(x + displayWidth, topY);
    ctx.lineTo(x + displayWidth - 3, topY - 3);
    ctx.moveTo(x + displayWidth, topY);
    ctx.lineTo(x + displayWidth + 3, topY - 3);
    ctx.stroke();
    
    ctx.fillText(`${width} см`, centerX, topY - 8);
    
    // Размер по высоте (слева)
    const leftX = x - 10;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(leftX, y + displayHeight);
    ctx.stroke();
    
    // Стрелки для высоты
    ctx.beginPath();
    ctx.moveTo(leftX - 5, y);
    ctx.lineTo(leftX, y);
    ctx.lineTo(leftX - 3, y - 3);
    ctx.moveTo(leftX, y);
    ctx.lineTo(leftX - 3, y + 3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(leftX - 5, y + displayHeight);
    ctx.lineTo(leftX, y + displayHeight);
    ctx.lineTo(leftX - 3, y + displayHeight - 3);
    ctx.moveTo(leftX, y + displayHeight);
    ctx.lineTo(leftX - 3, y + displayHeight + 3);
    ctx.stroke();
    
    // Поворачиваем текст для высоты
    ctx.save();
    ctx.translate(leftX - 20, centerY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${height} см`, 0, 0);
    ctx.restore();
    
    // Название прибора (если есть)
    if (name) {
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(name, centerX, y + displayHeight + 25);
    }
    
    // Площадь
    const area = (width * height / 10000).toFixed(2);
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.fillText(`Площадь: ${area} м²`, centerX, y + displayHeight + 40);
    
  }, [width, height, name]);

  if (!width || !height) {
    return (
      <div className="dimensions-preview-empty">
        <p>Укажите размеры прибора для предпросмотра</p>
      </div>
    );
  }

  return (
    <div className="dimensions-preview-container">
      <h4>Предпросмотр размеров в визуальном редакторе:</h4>
      <canvas ref={canvasRef} className="dimensions-preview-canvas" />
    </div>
  );
};

export default ApplianceDimensionsPreview;




















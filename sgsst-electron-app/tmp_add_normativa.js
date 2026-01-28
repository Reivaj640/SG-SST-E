// Manejar la carga del archivo normativa-0312.json
ipcMain.handle('load-normativa', async () => {
  try {
    console.log('Handling load-normativa request');
    const normativaPath = path.join(__dirname, 'normativa-0312.json');
    const normativaData = await fsp.readFile(normativaPath, 'utf8');
    console.log('Normativa loaded successfully');
    return JSON.parse(normativaData);
  } catch (error) {
    console.error('Error loading normativa:', error);
    // En caso de error, devolver una estructura vacía o valores por defecto
    return {
      escenarios: {}
    };
  }
});
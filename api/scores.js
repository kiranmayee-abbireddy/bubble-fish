// Simple Express endpoint for scores
app.get('/api/scores', (req, res) => {
  res.json({
    highScore: getHighScore(),
    daily: getDailyScores(),
    weekly: getWeeklyScores()
  });
}); 
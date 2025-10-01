document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('result-page');
  const taskId = page.dataset.taskId;
  const initialStatus = page.dataset.initialStatus;

  const statusBadge = document.getElementById('status-badge');
  const evaluateBtn = document.getElementById('evaluate-btn');
  const resultContainer = document.getElementById('result-container');
  const rawOutputContainer = document.getElementById('raw-output-container');
  const errorMessage = document.getElementById('error-message');

  function setStatus(status) {
    statusBadge.textContent = status;
    evaluateBtn.style.display = 'none';
    resultContainer.style.display = 'none';
    rawOutputContainer.style.display = 'none';
    errorMessage.style.display = 'none';

    switch (status) {
      case 'uploaded':
      case 'failed':
        evaluateBtn.style.display = 'block';
        evaluateBtn.disabled = false;
        evaluateBtn.textContent = 'Evaluate';
        if (status === 'failed') {
          errorMessage.textContent = 'Evaluation failed. Please try again.';
          errorMessage.style.display = 'block';
        }
        break;
      case 'queued':
      case 'processing':
        evaluateBtn.style.display = 'block';
        evaluateBtn.disabled = true;
        evaluateBtn.textContent = 'Processing...';
        break;
      case 'completed':
        // no polling, just show status
        break;
    }
  }

  async function pollForResult() {
    try {
      const res = await fetch(`/result/${taskId}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();

      setStatus(data.status);

      if (data.status === 'completed') {
        displayResults(data.result);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
      errorMessage.textContent = 'Could not fetch results. Check the console for details.';
      errorMessage.style.display = 'block';
    }
  }

  function displayResults(result) {
    if (!result) return;
    resultContainer.style.display = 'block';
    document.getElementById('cv-match-rate').textContent = `${result.cv_match_rate.toFixed(2)}%`;
    document.getElementById('cv-feedback').textContent = result.cv_feedback || 'N/A';
    document.getElementById('project-score').textContent = `${result.project_score.toFixed(2)} / 10`;
    document.getElementById('project-feedback').textContent = result.project_feedback || 'N/A';
    document.getElementById('overall-summary').textContent = result.overall_summary || 'N/A';

    if (result.raw_llm_outputs) {
      rawOutputContainer.style.display = 'block';
      document.getElementById('raw-output').textContent = JSON.stringify(result.raw_llm_outputs, null, 2);
    }
  }

  evaluateBtn.addEventListener('click', async () => {
    evaluateBtn.disabled = true;
    errorMessage.style.display = 'none';
    try {
      const res = await fetch('/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error('Failed to queue evaluation job.');
      const data = await res.json();
      setStatus(data.status);
    } catch (error) {
      console.error('Evaluation trigger failed:', error);
      errorMessage.textContent = error.message;
      errorMessage.style.display = 'block';
      evaluateBtn.disabled = false;
    }
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.id = 'refresh-btn';
  refreshBtn.textContent = 'Refresh Results';
  document.getElementById('controls').appendChild(refreshBtn);

  refreshBtn.addEventListener('click', () => {
    pollForResult();
  });

  setStatus(initialStatus);
  if (initialStatus === 'completed') {
    pollForResult();
  }
});

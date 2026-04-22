import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Iniciar execução de um processo
router.post('/executions/start/:processId', verifyToken, async (req, res) => {
  try {
    const processId = req.params.processId;

    // Verificar se processo existe
    const [processes] = await pool.execute(
      'SELECT * FROM processes WHERE id = ?',
      [processId]
    );

    if (processes.length === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    // Criar execução
    const [result] = await pool.execute(
      `INSERT INTO process_executions (process_id, user_id) VALUES (?, ?)`,
      [processId, req.userId]
    );

    const executionId = result.insertId;

    // Criar registro para cada passo
    const [steps] = await pool.execute(
      'SELECT * FROM steps WHERE process_id = ? ORDER BY step_number',
      [processId]
    );

    for (let step of steps) {
      await pool.execute(
        `INSERT INTO step_executions (execution_id, step_id) VALUES (?, ?)`,
        [executionId, step.id]
      );
    }

    res.status(201).json({
      execution_id: executionId,
      message: 'Execução iniciada com sucesso'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter execução em andamento
router.get('/executions/:executionId', verifyToken, async (req, res) => {
  try {
    const [executions] = await pool.execute(
      `SELECT pe.*, p.title, p.description, u.name as started_by_name
       FROM process_executions pe
       JOIN processes p ON pe.process_id = p.id
       JOIN users u ON pe.user_id = u.id
       WHERE pe.id = ?`,
      [req.params.executionId]
    );

    if (executions.length === 0) {
      return res.status(404).json({ error: 'Execução não encontrada' });
    }

    const execution = executions[0];

    // Obter passos com status de conclusão
    const [stepExecutions] = await pool.execute(
      `SELECT se.*, s.title, s.description, s.documentation_markdown
       FROM step_executions se
       JOIN steps s ON se.step_id = s.id
       WHERE se.execution_id = ?
       ORDER BY s.step_number`,
      [req.params.executionId]
    );

    execution.steps = stepExecutions;

    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar passo como completo
router.put('/step-executions/:stepExecutionId/complete', verifyToken, async (req, res) => {
  try {
    const { notes } = req.body;

    const [stepExec] = await pool.execute(
      'SELECT * FROM step_executions WHERE id = ?',
      [req.params.stepExecutionId]
    );

    if (stepExec.length === 0) {
      return res.status(404).json({ error: 'Passo não encontrado' });
    }

    await pool.execute(
      `UPDATE step_executions 
       SET completed_at = NOW(), notes = ?, completed_by = ?
       WHERE id = ?`,
      [notes || '', req.userId, req.params.stepExecutionId]
    );

    res.json({ message: 'Passo marcado como completo' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Finalizar execução
router.put('/executions/:executionId/complete', verifyToken, async (req, res) => {
  try {
    const [executions] = await pool.execute(
      'SELECT * FROM process_executions WHERE id = ?',
      [req.params.executionId]
    );

    if (executions.length === 0) {
      return res.status(404).json({ error: 'Execução não encontrada' });
    }

    // Verificar se todos os passos foram completados
    const [incompleteSteps] = await pool.execute(
      `SELECT COUNT(*) as count FROM step_executions 
       WHERE execution_id = ? AND completed_at IS NULL`,
      [req.params.executionId]
    );

    if (incompleteSteps[0].count > 0) {
      return res.status(400).json({ 
        error: 'Não é possível finalizar com passos incompletos',
        incomplete_count: incompleteSteps[0].count
      });
    }

    await pool.execute(
      `UPDATE process_executions 
       SET completed_at = NOW(), status = 'completed'
       WHERE id = ?`,
      [req.params.executionId]
    );

    res.json({ message: 'Execução finalizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar execução
router.put('/executions/:executionId/cancel', verifyToken, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE process_executions 
       SET status = 'abandoned'
       WHERE id = ?`,
      [req.params.executionId]
    );

    res.json({ message: 'Execução cancelada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar minhas execuções recentes
router.get('/executions/user/me', verifyToken, async (req, res) => {
  try {
    const [executions] = await pool.execute(
      `SELECT pe.*, p.title, p.description
       FROM process_executions pe
       JOIN processes p ON pe.process_id = p.id
       WHERE pe.user_id = ?
       ORDER BY pe.started_at DESC
       LIMIT 20`,
      [req.userId]
    );

    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

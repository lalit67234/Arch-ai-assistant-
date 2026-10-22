package com.aistudio.arch.aiast

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * ARCH Unified Repository
 *
 * Provides a clean interface for asynchronous persistence operations across:
 * - Conversation session replay and recovery
 * - Long-term associative memories
 * - Persistent reminders
 */
class ArchRepository(context: Context) {

    private val db = ArchDatabase.getInstance(context)
    private val conversationDao = db.conversationDao()
    private val memoryDao = db.memoryDao()
    private val reminderDao = db.reminderDao()

    // --- Conversation Persistence ---

    suspend fun saveMessage(role: String, text: String, metadata: String? = null): Long =
        withContext(Dispatchers.IO) {
            conversationDao.insertMessage(
                ConversationEntity(role = role, text = text, metadata = metadata)
            )
        }

    suspend fun getRecentMessages(limit: Int = 30): List<ConversationEntity> =
        withContext(Dispatchers.IO) {
            conversationDao.getRecentMessages(limit).reversed()
        }

    suspend fun clearConversation(): Unit =
        withContext(Dispatchers.IO) {
            conversationDao.clearHistory()
        }

    // --- Long-Term Explicit Memory ---

    suspend fun saveMemory(id: String, key: String, category: String, content: String): Unit =
        withContext(Dispatchers.IO) {
            memoryDao.insertOrUpdate(
                MemoryEntity(id = id, key = key, category = category, content = content)
            )
        }

    suspend fun getAllMemories(): List<MemoryEntity> =
        withContext(Dispatchers.IO) {
            memoryDao.getAllMemories()
        }

    suspend fun searchMemories(query: String): List<MemoryEntity> =
        withContext(Dispatchers.IO) {
            memoryDao.searchMemories(query)
        }

    suspend fun deleteMemory(id: String): Boolean =
        withContext(Dispatchers.IO) {
            memoryDao.deleteMemory(id) > 0
        }

    // --- Reminders ---

    suspend fun saveReminder(reminder: ReminderEntity): Unit =
        withContext(Dispatchers.IO) {
            reminderDao.insertOrUpdate(reminder)
        }

    suspend fun getPendingReminders(): List<ReminderEntity> =
        withContext(Dispatchers.IO) {
            reminderDao.getPendingReminders()
        }

    suspend fun getUpcomingReminders(afterTime: Long = System.currentTimeMillis()): List<ReminderEntity> =
        withContext(Dispatchers.IO) {
            reminderDao.getUpcomingReminders(afterTime)
        }

    suspend fun getAllReminders(): List<ReminderEntity> =
        withContext(Dispatchers.IO) {
            reminderDao.getAllReminders()
        }

    suspend fun markReminderCompleted(id: String): Unit =
        withContext(Dispatchers.IO) {
            reminderDao.markCompleted(id)
        }

    suspend fun cancelReminder(id: String): Unit =
        withContext(Dispatchers.IO) {
            reminderDao.cancelReminder(id)
        }

    suspend fun deleteReminder(id: String): Boolean =
        withContext(Dispatchers.IO) {
            reminderDao.deleteReminder(id) > 0
        }
}

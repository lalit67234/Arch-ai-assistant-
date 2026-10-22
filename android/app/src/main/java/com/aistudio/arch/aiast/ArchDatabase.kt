package com.aistudio.arch.aiast

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Update

/**
 * ARCH Local Persistent Database (Room / SQLite)
 *
 * Implements persistent storage for:
 * 1. Conversation History (survives app restarts)
 * 2. User Explicit Long-Term Memories (facts, preferences, project context)
 * 3. Scheduled Reminders (retained across device reboots)
 */

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val role: String, // "user" | "model" | "system"
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val metadata: String? = null
)

@Entity(tableName = "memories")
data class MemoryEntity(
    @PrimaryKey
    val id: String,
    val key: String,
    val category: String, // "identity" | "preference" | "goal" | "project" | "behavior"
    val content: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "reminders")
data class ReminderEntity(
    @PrimaryKey
    val id: String,
    val title: String,
    val triggerTimeMillis: Long,
    val recurrence: String? = null, // "none" | "daily" | "weekly"
    val isCompleted: Boolean = false,
    val isCancelled: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface ConversationDao {
    @Insert
    suspend fun insertMessage(message: ConversationEntity): Long

    @Query("SELECT * FROM conversations ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentMessages(limit: Int = 50): List<ConversationEntity>

    @Query("SELECT * FROM conversations ORDER BY timestamp ASC")
    suspend fun getAllMessages(): List<ConversationEntity>

    @Query("DELETE FROM conversations")
    suspend fun clearHistory()
}

@Dao
interface MemoryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(memory: MemoryEntity)

    @Query("SELECT * FROM memories ORDER BY updatedAt DESC")
    suspend fun getAllMemories(): List<MemoryEntity>

    @Query("SELECT * FROM memories WHERE category = :category ORDER BY updatedAt DESC")
    suspend fun getMemoriesByCategory(category: String): List<MemoryEntity>

    @Query("SELECT * FROM memories WHERE content LIKE '%' || :query || '%' OR key LIKE '%' || :query || '%'")
    suspend fun searchMemories(query: String): List<MemoryEntity>

    @Query("DELETE FROM memories WHERE id = :id")
    suspend fun deleteMemory(id: String): Int

    @Query("DELETE FROM memories")
    suspend fun clearAllMemories()
}

@Dao
interface ReminderDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(reminder: ReminderEntity)

    @Query("SELECT * FROM reminders WHERE isCompleted = 0 AND isCancelled = 0 ORDER BY triggerTimeMillis ASC")
    suspend fun getPendingReminders(): List<ReminderEntity>

    @Query("SELECT * FROM reminders WHERE triggerTimeMillis > :afterTime AND isCompleted = 0 AND isCancelled = 0 ORDER BY triggerTimeMillis ASC")
    suspend fun getUpcomingReminders(afterTime: Long): List<ReminderEntity>

    @Query("SELECT * FROM reminders ORDER BY createdAt DESC")
    suspend fun getAllReminders(): List<ReminderEntity>

    @Query("UPDATE reminders SET isCompleted = 1 WHERE id = :id")
    suspend fun markCompleted(id: String)

    @Query("UPDATE reminders SET isCancelled = 1 WHERE id = :id")
    suspend fun cancelReminder(id: String)

    @Query("DELETE FROM reminders WHERE id = :id")
    suspend fun deleteReminder(id: String): Int
}

@Database(
    entities = [ConversationEntity::class, MemoryEntity::class, ReminderEntity::class],
    version = 1,
    exportSchema = false
)
abstract class ArchDatabase : RoomDatabase() {
    abstract fun conversationDao(): ConversationDao
    abstract fun memoryDao(): MemoryDao
    abstract fun reminderDao(): ReminderDao

    companion object {
        @Volatile
        private var INSTANCE: ArchDatabase? = null

        fun getInstance(context: Context): ArchDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ArchDatabase::class.java,
                    "arch_master_vault.db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

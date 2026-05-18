import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

export default class CacheService {
  /**
   * Get a typed value from Redis
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      if (!data) return null
      return JSON.parse(data) as T
    } catch (err: any) {
      logger.error({ err, key }, '[CacheService] Failed to read from cache')
      return null
    }
  }

  /**
   * Write any value to Redis with an optional TTL (in seconds)
   */
  static async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds && ttlSeconds > 0) {
        await redis.setex(key, ttlSeconds, serialized)
      } else {
        await redis.set(key, serialized)
      }
    } catch (err: any) {
      logger.error({ err, key }, '[CacheService] Failed to write to cache')
    }
  }

  /**
   * Remove a value from Redis
   */
  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (err: any) {
      logger.error({ err, key }, '[CacheService] Failed to delete cache key')
    }
  }
}

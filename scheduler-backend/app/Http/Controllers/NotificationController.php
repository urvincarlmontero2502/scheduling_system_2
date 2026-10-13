<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    /**
     * Get the authenticated user's notifications.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $query = Notification::where('user_id', $user->user_id)
                ->orderBy('created_at', 'desc');

            if ($request->query('unread')) {
                $query->unread();
            }

            $notifications = $query->get();

            return response()->json($notifications);
        } catch (\Exception $e) {
            Log::error('Failed to fetch notifications: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to fetch notifications.'], 500);
        }
    }

    /**
     * Mark a single notification as read.
     *
     * @param  \App\Models\Notification  $notification
     * @return \Illuminate\Http\JsonResponse
     */
    public function markAsRead(Request $request, Notification $notification)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            if ($notification->user_id !== $user->user_id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }

            $notification->markAsRead();

            return response()->json(['message' => 'Notification marked as read.']);
        } catch (\Exception $e) {
            Log::error('Failed to mark notification as read: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update notification.'], 500);
        }
    }

    /**
     * Mark all notifications for the user as read.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function markAllAsRead(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            Notification::where('user_id', $user->user_id)
                ->where('is_read', false)
                ->update(['is_read' => true, 'read_at' => now()]);

            return response()->json(['message' => 'All notifications marked as read.']);
        } catch (\Exception $e) {
            Log::error('Failed to mark all notifications as read: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update notifications.'], 500);
        }
    }

    /**
     * Delete a notification (optional, for cleanup).
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Notification  $notification
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, Notification $notification)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            if ($notification->user_id !== $user->user_id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }

            $notification->delete();

            return response()->json(['message' => 'Notification deleted.']);
        } catch (\Exception $e) {
            Log::error('Failed to delete notification: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete notification.'], 500);
        }
    }

}

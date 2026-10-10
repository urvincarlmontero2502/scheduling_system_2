<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Allowed file types and max sizes.
     */
    private const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private const MAX_FILE_SIZE = 5120; // KB (5MB)
    private const SUBDIRS = ['facilities', 'vehicles', 'profiles', 'branding'];

    /**
     * Get the storage subdirectory for a given asset type.
     */
    private function getSubdir(string $assetType): string
    {
        $map = [
            'facility' => 'facilities',
            'vehicle' => 'vehicles',
            'profile' => 'profiles',
            'branding' => 'branding',
        ];

        return $map[$assetType] ?? 'branding';
    }

    /**
     * Upload a single image file to the appropriate subdirectory.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function upload(Request $request)
    {
        $assetType = $request->input('asset_type', 'branding');

        $request->validate([
            'file' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,png,jpg,gif,webp',
                'max:' . self::MAX_FILE_SIZE,
            ],
            'asset_type' => ['required', 'in:facility,vehicle,profile,branding'],
        ]);

        $subdir = $this->getSubdir($assetType);

        // Generate unique filename
        $filename = Str::uuid() . '.' . $request->file('file')->getClientOriginalExtension();

        // Store on the 'assets' disk
        $path = $request->file('file')->storeAs($subdir, $filename, 'assets');

        $url = Storage::disk('assets')->url($path);

        // Log the upload
        DB::table('asset_logs')->insert([
            'user_id' => $request->user() ? $request->user()->user_id : null,
            'asset_type' => $assetType,
            'old_path' => null,
            'new_path' => $path,
            'action' => 'upload',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'path' => $path,
            'url' => $url,
            'asset_type' => $assetType,
            'filename' => $filename,
            'mime_type' => $request->file('file')->getMimeType(),
            'size' => $request->file('file')->getSize(),
        ]);
    }

    /**
     * Delete an uploaded image.
     */
    public function delete(Request $request)
    {
        $request->validate([
            'path' => ['required', 'string'],
            'asset_type' => ['required', 'in:facility,vehicle,profile,branding'],
        ]);

        $path = $request->input('path');

        if (Storage::disk('assets')->exists($path)) {
            $deleted = Storage::disk('assets')->delete($path);

            if ($deleted) {
                // Log the delete
                DB::table('asset_logs')->insert([
                    'user_id' => $request->user() ? $request->user()->user_id : null,
                    'asset_type' => $request->input('asset_type'),
                    'old_path' => $path,
                    'new_path' => null,
                    'action' => 'delete',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return response()->json(['message' => 'File deleted successfully.']);
            }
        }

        return response()->json(['message' => 'File not found.'], 404);
    }

    /**
     * Get a file's URL (with fallback if the file doesn't exist).
     */
    public function getFile($path)
    {
        $path = urldecode($path);

        if (!Storage::disk('assets')->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->json([
            'url' => Storage::disk('assets')->url($path),
            'path' => $path,
            'mime_type' => Storage::disk('assets')->mimeType($path),
            'size' => Storage::disk('assets')->size($path),
        ]);
    }
}

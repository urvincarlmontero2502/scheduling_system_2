<?php

namespace App\Http\Controllers;

use App\Models\Resource;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ResourceController extends Controller
{
    /**
     * Format a Resource model into a consistent response shape
     * that matches the index() output (with both `id` and `resource_id`).
     */
    protected function formatResource($resource)
    {
        $imagePaths = $resource->images ?: ($resource->image ? [$resource->image] : []);
        $imageUrls = array_map(
            fn ($path) => Storage::disk('assets')->url($path),
            $imagePaths
        );

        return [
            'id' => $resource->resource_id,
            'resource_id' => $resource->resource_id,
            'name' => $resource->name,
            'type' => $resource->type,
            'image' => $imageUrls[0] ?? null,
            'image_url' => $imageUrls[0] ?? null,
            'images' => $imageUrls,
            'available' => $resource->status === 'available',
            'status' => $resource->status,
            'is_maintenance' => $resource->status === 'maintenance',
            'description' => $resource->description ?? null,
            'buffer_minutes' => $resource->buffer_minutes ?? 30,
            'capacity' => $resource->type === 'facility' && $resource->facilityDetails
                ? $resource->facilityDetails->capacity.' pax'
                : null,
            'unit_name' => $resource->type === 'vehicle' && $resource->vehicleDetails
                ? ($resource->vehicleDetails->unit_name ?? null)
                : null,
        ];
    }

    public function index(Request $request)
    {
        try {
            // Select only necessary columns to minimize payload:
            // resource_id, name, type, status, image, description, buffer_minutes
            // Use explicit table prefix on resource_id to avoid ambiguity when
            // joining facility_details and vehicle_details (both have resource_id)
            $columns = [
                'resources.resource_id',
                'resources.name',
                'resources.type',
                'resources.status',
                'resources.image',
                'resources.images',
                'resources.buffer_minutes',
            ];

            // Check if description column exists before selecting it
            if (Schema::hasColumn('resources', 'description')) {
                $columns[] = 'resources.description';
            }

            $query = Resource::query()->select($columns);

            if ($request->has('type')) {
                $query->where('resources.type', $request->query('type'));
            }

            $isFacility = $request->query('type') === 'facility';
            $isVehicle = $request->query('type') === 'vehicle';

            // Only join detail tables if they exist
            if (! $request->has('type') || $isFacility) {
                if (Schema::hasTable('facility_details')) {
                    $query->leftJoin('facility_details', 'facility_details.resource_id', '=', 'resources.resource_id')
                        ->addSelect('facility_details.capacity as facility_capacity');
                }
            }
            if (! $request->has('type') || $isVehicle) {
                if (Schema::hasTable('vehicle_details')) {
                    $query->leftJoin('vehicle_details', 'vehicle_details.resource_id', '=', 'resources.resource_id')
                        ->addSelect('vehicle_details.unit_name as vehicle_unit_name');
                }
            }

            $resources = $query->get()->map(function ($r) {
                $imagePaths = $r->images ?: ($r->image ? [$r->image] : []);
                $imageUrls = array_map(
                    fn ($path) => Storage::disk('assets')->url($path),
                    $imagePaths
                );

                return [
                    'id' => $r->resource_id,
                    'resource_id' => $r->resource_id,
                    'name' => $r->name,
                    'type' => $r->type,
                    'image' => $imageUrls[0] ?? null,
                    'image_url' => $imageUrls[0] ?? null,
                    'images' => $imageUrls,
                    'available' => $r->status === 'available',
                    'status' => $r->status,
                    'is_maintenance' => $r->status === 'maintenance',
                    'description' => $r->description ?? null,
                    'buffer_minutes' => $r->buffer_minutes ?? 30,
                    'capacity' => $r->type === 'facility' && $r->facility_capacity
                        ? $r->facility_capacity.' pax'
                        : null,
                    'unit_name' => $r->type === 'vehicle' ? ($r->vehicle_unit_name ?? null) : null,
                ];
            });

            return response()->json($resources);
        } catch (\Throwable $e) {
            // Return detailed error in dev mode; user-friendly message otherwise
            $message = config('app.debug')
                ? $e->getMessage().' | File: '.$e->getFile().':'.$e->getLine()
                : 'Failed to fetch resources';

            return response()->json(['error' => $message], 500);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:facility,vehicle'],
            'description' => ['nullable', 'string'],
            'buffer_minutes' => ['required', 'integer', 'min:0'],
            'capacity' => ['nullable', 'integer'], // Specific to facilities
            'unit_name' => ['nullable', 'string'], // Specific to vehicles
            'image' => ['nullable', 'image', 'max:2048'], // Optional image upload validation
            'images' => ['sometimes', 'array', 'max:3'],
            'images.*' => ['image', 'max:2048'],
        ]);

        $imagePaths = $this->storeResourceImages($request, $validated['type']);

        // Create the parent resource record
        $resource = Resource::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'buffer_minutes' => $validated['buffer_minutes'] ?? 30,
            'image' => $imagePaths[0] ?? null,
            'images' => $imagePaths,
            'status' => 'available',
        ]);

        // Create the corresponding details row based on resource type
        if ($validated['type'] === 'facility') {
            $resource->facilityDetails()->create([
                'capacity' => $validated['capacity'] ?? null,
            ]);
        } else {
            $resource->vehicleDetails()->create([
                'unit_name' => $validated['unit_name'] ?? null,
            ]);
        }

        $resource->load(['facilityDetails', 'vehicleDetails']);
        app(ActivityLogger::class)->record(
            $request->user(),
            'resource.created',
            sprintf('Added %s resource "%s".', $validated['type'], $resource->name),
            'resource',
            $resource->resource_id,
            ['resource_name' => $resource->name, 'resource_type' => $resource->type]
        );

        return response()->json([
            'resource' => $this->formatResource($resource),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $resource = Resource::findOrFail($id);
        $previousName = $resource->name;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:facility,vehicle'],
            'description' => ['nullable', 'string'],
            'buffer_minutes' => ['required', 'integer', 'min:0'],
            'capacity' => ['nullable', 'string'],
            'unit_name' => ['nullable', 'string'],
            'status' => ['nullable', 'in:available,unavailable,maintenance'],
            'image' => ['nullable', 'image', 'max:2048'], // Optional image upload on update
            'images' => ['sometimes', 'array', 'max:3'],
            'images.*' => ['image', 'max:2048'],
        ]);

        $imagePath = $resource->image;
        $imagePaths = $resource->images ?: ($resource->image ? [$resource->image] : []);
        if ($request->hasFile('images') || $request->hasFile('image')) {
            Storage::disk('assets')->delete(array_unique($imagePaths));
            $imagePaths = $this->storeResourceImages($request, $validated['type']);
            $imagePath = $imagePaths[0] ?? null;
        }

        $updateData = [
            'name' => $validated['name'],
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'image' => $imagePath,
            'images' => $imagePaths,
        ];

        $updateData['buffer_minutes'] = $validated['buffer_minutes'];

        if (isset($validated['status'])) {
            $updateData['status'] = $validated['status'];
        }

        $resource->update($updateData);

        if ($validated['type'] === 'facility') {
            $resource->facilityDetails()->updateOrCreate(
                ['resource_id' => $resource->resource_id],
                ['capacity' => $validated['capacity'] ?? null]
            );
        } else {
            $resource->vehicleDetails()->updateOrCreate(
                ['resource_id' => $resource->resource_id],
                ['unit_name' => $validated['unit_name'] ?? $validated['capacity'] ?? null]
            );
        }

        $resource->load(['facilityDetails', 'vehicleDetails']);
        app(ActivityLogger::class)->record(
            $request->user(),
            'resource.updated',
            sprintf('Updated resource "%s".', $resource->name),
            'resource',
            $resource->resource_id,
            [
                'previous_name' => $previousName,
                'resource_name' => $resource->name,
                'resource_type' => $resource->type,
                'status' => $resource->status,
            ]
        );

        return response()->json([
            'resource' => $this->formatResource($resource),
            'message' => 'Resource updated successfully.',
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $resource = Resource::findOrFail($id);
        $resourceName = $resource->name;
        $resourceType = $resource->type;

        $imagePaths = $resource->images ?: ($resource->image ? [$resource->image] : []);
        Storage::disk('assets')->delete(array_unique($imagePaths));

        // Cascade deletes child details automatically if configured in DB,
        // otherwise delete them explicitly:
        $resource->facilityDetails()->delete();
        $resource->vehicleDetails()->delete();

        $resource->delete();

        app(ActivityLogger::class)->record(
            $request->user(),
            'resource.deleted',
            sprintf('Deleted resource "%s".', $resourceName),
            'resource',
            $id,
            ['resource_name' => $resourceName, 'resource_type' => $resourceType]
        );

        return response()->json(['message' => 'Resource deleted successfully']);
    }

    private function storeResourceImages(Request $request, string $type): array
    {
        $files = $request->file('images', []);
        if (! is_array($files)) {
            $files = [$files];
        }
        if (empty($files) && $request->hasFile('image')) {
            $files = [$request->file('image')];
        }

        $subdir = $type === 'facility' ? 'facilities' : 'vehicles';

        return array_map(function ($file) use ($subdir) {
            $filename = Str::uuid().'.'.$file->getClientOriginalExtension();

            return $file->storeAs($subdir, $filename, 'assets');
        }, $files);
    }

    public function setMaintenance(Request $request, $id)
    {
        $resource = Resource::findOrFail($id);

        $resource->update(['status' => 'maintenance']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'resource.maintenance_enabled',
            sprintf('Marked resource "%s" as under maintenance.', $resource->name),
            'resource',
            $resource->resource_id,
            ['resource_name' => $resource->name]
        );

        return response()->json([
            'message' => "{$resource->name} is now marked for maintenance.",
            'resource' => $this->formatResource($resource),
        ]);
    }

    public function setAvailable(Request $request, $id)
    {
        $resource = Resource::findOrFail($id);

        $resource->update(['status' => 'available']);

        app(ActivityLogger::class)->record(
            $request->user(),
            'resource.maintenance_disabled',
            sprintf('Marked resource "%s" as available.', $resource->name),
            'resource',
            $resource->resource_id,
            ['resource_name' => $resource->name]
        );

        return response()->json([
            'message' => "{$resource->name} is now available.",
            'resource' => $this->formatResource($resource),
        ]);
    }
}

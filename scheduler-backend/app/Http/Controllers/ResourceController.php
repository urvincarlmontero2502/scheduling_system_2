<?php

namespace App\Http\Controllers;

use App\Models\Resource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ResourceController extends Controller
{
    public function index(Request $request)
    {
        $query = Resource::with(['facilityDetails', 'vehicleDetails']);

        if ($request->has('type')) {
            $query->where('type', $request->query('type'));
        }

        $resources = $query->get()->map(function ($r) {
            $details = $r->type === 'facility' ? $r->facilityDetails : $r->vehicleDetails;

            return [
                'id' => $r->resource_id,
                'name' => $r->name,
                'type' => $r->type,
                'image' => $r->image ? asset('storage/' . $r->image) : null,
                'available' => $r->status === 'available',
                'description' => $r->description,
                'capacity' => $r->type === 'facility'
                    ? ($details->capacity ?? null) . ' pax'
                    : ($details->unit_name ?? null),
            ];
        });

        return response()->json($resources);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:facility,vehicle'],
            'description' => ['nullable', 'string'],
            'capacity' => ['nullable', 'integer'], // Specific to facilities
            'unit_name' => ['nullable', 'string'], // Specific to vehicles
            'image' => ['nullable', 'image', 'max:2048'], // Optional image upload validation
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('resources', 'public');
        }

        // Create the parent resource record
        $resource = Resource::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'image' => $imagePath,
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

        return response()->json($resource->load(['facilityDetails', 'vehicleDetails']), 201);
    }

    public function update(Request $request, $id)
    {
        $resource = Resource::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:facility,vehicle'],
            'description' => ['nullable', 'string'],
            'capacity' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:2048'], // Optional image upload on update
        ]);

        $imagePath = $resource->image;
        if ($request->hasFile('image')) {
            // Delete old image if a new one is uploaded
            if ($resource->image) {
                Storage::disk('public')->delete($resource->image);
            }
            $imagePath = $request->file('image')->store('resources', 'public');
        }

        $resource->update([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'image' => $imagePath,
        ]);

        if ($validated['type'] === 'facility') {
            $resource->facilityDetails()->updateOrCreate(
                ['resource_id' => $resource->resource_id],
                ['capacity' => $validated['capacity'] ?? null]
            );
        } else {
            $resource->vehicleDetails()->updateOrCreate(
                ['resource_id' => $resource->resource_id],
                ['unit_name' => $validated['capacity'] ?? null]
            );
        }

        return response()->json($resource->load(['facilityDetails', 'vehicleDetails']));
    }

    public function destroy($id)
    {
        $resource = Resource::findOrFail($id);

        // Delete image file from storage if it exists
        if ($resource->image) {
            Storage::disk('public')->delete($resource->image);
        }

        // Cascade deletes child details automatically if configured in DB,
        // otherwise delete them explicitly:
        $resource->facilityDetails()->delete();
        $resource->vehicleDetails()->delete();

        $resource->delete();

        return response()->json(['message' => 'Resource deleted successfully']);
    }
}

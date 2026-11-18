<?php

namespace App\Http\Controllers;

use App\Models\Resource;
use App\Models\SpecialEventTemplate;
use App\Services\SpecialEventReservationSeeder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SpecialEventTemplateController extends Controller
{
    public function index()
    {
        return response()->json(
            SpecialEventTemplate::query()
                ->orderBy('name')
                ->orderBy('start_year')
                ->get()
                ->map(fn (SpecialEventTemplate $template) => $this->serialize($template))
                ->values()
        );
    }

    public function store(Request $request, SpecialEventReservationSeeder $seeder)
    {
        $data = $this->validatedData($request);

        $template = DB::transaction(function () use ($data, $seeder) {
            $template = SpecialEventTemplate::create($data);
            $seeder->syncTemplate($template, rejectConflicts: true);

            return $template;
        });

        return response()->json($this->serialize($template->fresh()), 201);
    }

    public function update(
        Request $request,
        int $specialEvent,
        SpecialEventReservationSeeder $seeder
    ) {
        $data = $this->validatedData($request, $specialEvent);

        $template = DB::transaction(function () use ($specialEvent, $data, $seeder) {
            $template = SpecialEventTemplate::query()
                ->lockForUpdate()
                ->findOrFail($specialEvent);

            $template->update($data);
            $seeder->syncTemplate($template, replaceUpcoming: true, rejectConflicts: true);

            return $template;
        });

        return response()->json($this->serialize($template->fresh()));
    }

    public function destroy(int $specialEvent, SpecialEventReservationSeeder $seeder)
    {
        DB::transaction(function () use ($specialEvent, $seeder) {
            $template = SpecialEventTemplate::query()
                ->lockForUpdate()
                ->findOrFail($specialEvent);

            DB::table('booking_request')
                ->where('special_event_template_id', $template->id)
                ->where('start_date', '>=', now('Asia/Manila')->toDateString())
                ->delete();

            $template->delete();
            $seeder->run();
        });

        return response()->json([
            'message' => 'The recurring event was removed. Past reservations were kept.',
        ]);
    }

    private function validatedData(Request $request, ?int $ignoreTemplateId = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'resource_ids' => ['required', 'array', 'min:1'],
            'resource_ids.*' => ['required', 'integer', 'distinct', 'exists:resources,resource_id'],
        ]);

        $startDate = Carbon::createFromFormat('Y-m-d', $validated['start_date']);
        $endDate = Carbon::createFromFormat('Y-m-d', $validated['end_date']);
        if ($startDate->year !== $endDate->year) {
            throw ValidationException::withMessages([
                'end_date' => ['The recurring date range must start and end within the same year.'],
            ]);
        }

        $resourceIds = array_map('intval', $validated['resource_ids']);
        $activeResourceCount = Resource::query()
            ->whereIn('resource_id', $resourceIds)
            ->count();
        if ($activeResourceCount !== count($resourceIds)) {
            throw ValidationException::withMessages([
                'resource_ids' => ['Select active resources only.'],
            ]);
        }

        $this->ensureNoRecurringConflict($startDate, $endDate, $resourceIds, $ignoreTemplateId);

        return [
            'name' => trim($validated['name']),
            'start_year' => $startDate->year,
            'start_month' => $startDate->month,
            'start_day' => $startDate->day,
            'end_month' => $endDate->month,
            'end_day' => $endDate->day,
            'resource_ids' => $resourceIds,
        ];
    }

    private function ensureNoRecurringConflict(
        Carbon $startDate,
        Carbon $endDate,
        array $resourceIds,
        ?int $ignoreTemplateId
    ): void {
        $startDay = $startDate->month * 100 + $startDate->day;
        $endDay = $endDate->month * 100 + $endDate->day;

        $existingTemplates = SpecialEventTemplate::query();
        if ($ignoreTemplateId !== null) {
            $existingTemplates->where('id', '<>', $ignoreTemplateId);
        }

        foreach ($existingTemplates->get() as $existing) {
            $existingStartDay = (int) $existing->start_month * 100 + (int) $existing->start_day;
            $existingEndDay = (int) $existing->end_month * 100 + (int) $existing->end_day;
            $sharesResource = array_intersect(
                $resourceIds,
                array_map('intval', $existing->resource_ids ?? [])
            ) !== [];

            if (
                $sharesResource
                && max($startDay, $existingStartDay) <= min($endDay, $existingEndDay)
            ) {
                throw ValidationException::withMessages([
                    'resource_ids' => ['A selected resource is already assigned to a recurring special event during these dates.'],
                ]);
            }
        }
    }

    private function serialize(SpecialEventTemplate $template): array
    {
        $resourceIds = array_map('intval', $template->resource_ids ?? []);
        $resources = Resource::withTrashed()
            ->whereIn('resource_id', $resourceIds)
            ->orderBy('name')
            ->get(['resource_id', 'name', 'type'])
            ->values();

        return [
            'id' => $template->id,
            'name' => $template->name,
            'start_year' => (int) $template->start_year,
            'start_month' => (int) $template->start_month,
            'start_day' => (int) $template->start_day,
            'end_month' => (int) $template->end_month,
            'end_day' => (int) $template->end_day,
            'start_date' => $this->annualDate($template->start_year, $template->start_month, $template->start_day),
            'end_date' => $this->annualDate($template->start_year, $template->end_month, $template->end_day),
            'resource_ids' => $resourceIds,
            'resources' => $resources,
        ];
    }

    private function annualDate(int $year, int $month, int $day): string
    {
        $lastDay = Carbon::create($year, $month, 1)->daysInMonth;

        return sprintf('%04d-%02d-%02d', $year, $month, min($day, $lastDay));
    }
}

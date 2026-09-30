import { useEffect, useState } from "react";
import { Building2, Car, Clock, CheckCircle2 } from "lucide-react";
import * as api from "../api/endpoints";

export default function Dashboard() {
  const [stats, setStats] = useState({ pending: 0, approvedWeekly: 0 });
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api
        .fetchDashboardStats()
        .catch(() => ({ data: { pending: 0, approvedWeekly: 0 } })),
      api.fetchResources().catch(() => ({ data: [] })),
    ])
      .then(([statsRes, resourcesRes]) => {
        if (statsRes.data) setStats(statsRes.data);
        if (resourcesRes.data) setResources(resourcesRes.data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const facilitiesCount = resources.filter((r) => r.type === "facility").length;
  const vehiclesCount = resources.filter((r) => r.type === "vehicle").length;

  return (
    <div>
      <header className="border-b border-line bg-white px-6 py-4">
        <h1 className="text-[17px] font-semibold">Welcome back</h1>
        <p className="text-[13px] text-steel">
          Here's what's happening with facility and vehicle bookings
        </p>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* Stat Cards Grid matching your dashboard design */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Pending Requests */}
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[28px] font-bold text-black">
                {loading ? "..." : stats.pending || 0}
              </span>
              <Clock size={20} className="text-steel" />
            </div>
            <p className="text-[13px] text-steel mt-2">Pending requests</p>
          </div>

          {/* Approved This Week */}
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[28px] font-bold text-black">
                {loading ? "..." : stats.approvedWeekly || 0}
              </span>
              <CheckCircle2 size={20} className="text-steel" />
            </div>
            <p className="text-[13px] text-steel mt-2">Approved this week</p>
          </div>

          {/* Facilities Count */}
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[28px] font-bold text-black">
                {loading ? "..." : facilitiesCount}
              </span>
              <Building2 size={20} className="text-steel" />
            </div>
            <p className="text-[13px] text-steel mt-2">Active facilities</p>
          </div>

          {/* Vehicles Count */}
          <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[28px] font-bold text-black">
                {loading ? "..." : vehiclesCount}
              </span>
              <Car size={20} className="text-steel" />
            </div>
            <p className="text-[13px] text-steel mt-2">Active vehicles</p>
          </div>
        </div>

        {/* Getting Started Banner */}
        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h2 className="text-[14px] font-semibold text-black mb-1">
            Getting started
          </h2>
          <p className="text-[13px] text-steel">
            This dashboard is connected to your Laravel API. Visit Calendar to
            view the live schedule or Bookings to review and act on requests.
          </p>
        </div>
      </div>
    </div>
  );
}

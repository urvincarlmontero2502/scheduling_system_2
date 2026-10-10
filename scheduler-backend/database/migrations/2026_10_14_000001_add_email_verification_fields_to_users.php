<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table("users", function (Blueprint $table) {
            if (!Schema::hasColumn("users", "pending_email")) {
                $table->string("pending_email")->nullable();
            }
            if (!Schema::hasColumn("users", "email_verification_token")) {
                $table->string("email_verification_token", 64)->nullable()->index();
            }
            if (!Schema::hasColumn("users", "email_verification_sent_at")) {
                $table->timestamp("email_verification_sent_at")->nullable();
            }
        });

        // password_resets table (Laravel standard, for forgot password)
        if (!Schema::hasTable("password_resets")) {
            Schema::create("password_resets", function (Blueprint $table) {
                $table->id("id");
                $table->string("email")->index();
                $table->string("token");
                $table->timestamp("created_at")->nullable();
            });
        }

        // Audit log table for email change attempts
        if (!Schema::hasTable("email_change_logs")) {
            Schema::create("email_change_logs", function (Blueprint $table) {
                $table->id("log_id");
                $table->unsignedBigInteger("user_id");
                $table->string("old_email");
                $table->string("new_email");
                $table->string("status")->default("pending");
                $table->string("ip_address")->nullable();
                $table->timestamps();

                $table->foreign("user_id")->references("user_id")->on("users")->onDelete("cascade");
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists("email_change_logs");
        Schema::dropIfExists("password_resets");

        Schema::table("users", function (Blueprint $table) {
            if (Schema::hasColumn("users", "pending_email")) {
                $table->dropColumn("pending_email");
            }
            if (Schema::hasColumn("users", "email_verification_token")) {
                $table->dropColumn("email_verification_token");
            }
            if (Schema::hasColumn("users", "email_verification_sent_at")) {
                $table->dropColumn("email_verification_sent_at");
            }
        });
    }
};

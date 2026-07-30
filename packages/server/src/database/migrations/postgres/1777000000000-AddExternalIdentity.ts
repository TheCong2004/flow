import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddExternalIdentity1777000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS external_identity (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                provider varchar(50) NOT NULL,
                "providerUserId" varchar(255) NOT NULL,
                "flowiseUserId" uuid NOT NULL,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_external_identity" PRIMARY KEY (id),
                CONSTRAINT "UQ_external_identity_provider_subject" UNIQUE (provider, "providerUserId"),
                CONSTRAINT "FK_external_identity_flowise_user"
                    FOREIGN KEY ("flowiseUserId") REFERENCES "user"(id) ON DELETE CASCADE
            )
        `)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_external_identity_flowise_user" ON external_identity ("flowiseUserId")`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS external_identity`)
    }
}

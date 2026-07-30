import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm'

@Entity({ name: 'external_identity' })
@Unique('UQ_external_identity_provider_subject', ['provider', 'providerUserId'])
export class ExternalIdentity {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 50 })
    provider: string

    @Column({ type: 'varchar', length: 255 })
    providerUserId: string

    @Index('IDX_external_identity_flowise_user')
    @Column({ type: 'uuid' })
    flowiseUserId: string

    @CreateDateColumn()
    createdDate: Date
}

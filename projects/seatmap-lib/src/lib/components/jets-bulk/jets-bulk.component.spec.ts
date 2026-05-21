import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsBulkComponent } from './jets-bulk.component';

describe('JetsBulkComponent', () => {
  let fixture: ComponentFixture<JetsBulkComponent>;
  let component: JetsBulkComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsBulkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsBulkComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should accept an empty bulks array', () => {
    component.bulks = [];
    fixture.detectChanges();
    expect(component.bulks).toEqual([]);
  });

  it('should accept a populated bulks array', () => {
    component.bulks = [
      { id: 'b1', type: 1, width: 50, height: 50, topOffset: 0, align: 'left' },
    ];
    fixture.detectChanges();
    expect(component.bulks).toHaveLength(1);
  });

  it('should respect scale and topAdjust inputs', () => {
    component.scale = 1.5;
    component.topAdjust = 12;
    fixture.detectChanges();
    expect(component.scale).toBeCloseTo(1.5);
    expect(component.topAdjust).toBe(12);
  });
});
